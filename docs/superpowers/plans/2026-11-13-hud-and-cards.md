# Riding HUD, Ring Cards, List and Result Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-line challenge banner with a trail sign, a goal tag and a one-star-at-a-time strip, add a segment speed ring and an energy arc over the stick, then carry the sign, star art and medals to the ring card, the area list and the result card.

**Architecture:** The numbers come from pure functions in `src/game/targets.ts`: `nextStarStrip`, `goalTag`, `starMedals` and `trickChips`. The speed zones come from `src/lab/speed-ring.ts`. All of these are unit-tested. A new `src/game/pieces.ts` (with `pieces.css`) turns them into HTML pieces that every screen shares: the sign, stars, cog, hill icons, strip and medals. `main.ts`, `map.ts`, `ride.ts` and `touch.ts` only place those pieces. The browser checks confirm what's on screen. The art is processed once by `art/ui/build.mjs` into small WebP files in `public/ui/`.

**Tech Stack:** TypeScript 5.6, Vitest 2.1 (node, no DOM), three.js overlay DOM, and headless Chromium over CDP for `checks/*.mjs` and the art script.

**Spec:** `docs/superpowers/specs/2026-11-07-hud-and-cards-design.md`. The mockups to match are `tricks-trimmed.html` (HUD layout) and `hills-in-place-v5.html` (art in place), both in `.superpowers/brainstorm/40117-1794093037/content/`.

## Global Constraints

- **Presentation only.** No change to scoring, star targets, time limits, pay, locks or `tick()`.
- **No typed numbers.** Every number comes from `def.goal`, `TRICK_INFO`, `MOVE_INFO`, `starPays`, `T`/`BIKE_RIDE`, never typed into a string.
- **One star at a time** on the riding HUD.
- **Buttons look as they do today.** No new button styles.
- **Number formats:**
  - Points use `n.toLocaleString('en-US')` (`12,000`), rounded down.
  - Star times print as the goal stores them (`String(n)`: `45`, `15.4`).
  - The run clock prints to one decimal with ` s` (`12.3 s`).
- **Every art piece keeps its glyph as text** (`★` won, `☆` not won, `⚙`, `↑ ↓ ↕`). The text is colored transparent over the background image, so `innerText`, screen readers and the existing checks still read it.
- **New class names start with `ui-`.** The mockups collided on `.g`, `.big` and `.card`.
- **`/index.html` is untouched.** `src/view/hud.ts` and `src/style.css` don't change, so `/index.html` (which also uses `createHud`) looks as it does today. New placement goes in `game.css`, `lab.css` (under `#lab`), `hub.css` or `pieces.css`.
- **Art:** WebP in `public/ui/`, each file ≤ 40 KB. Sources and keyed masters move out of `public/` into `art/ui/` so they don't ship.
- **Check viewport:** 1180×820 (the iPad in landscape).
- Git (updated Nov 24): the project is now a real repo. Work on a branch, commit normally (read "snapshot" steps as commits), push, open a PR with `gh pr create`; `main` is protected. The `.superpowers/sdd-git` snapshots mentioned in this document are old history kept for reference.
- **Browser checks** need the dev server at `http://127.0.0.1:5173` (not localhost). Never run them during a robot sweep.

## Review Focus

1. **A time exactly on a star's time.** `byTime` uses `<=`, so at `t = 14.6` on a 14.6 s ★★★, the ★★★ fuse must still show, empty, and drop to ★★ only after it. Task 2 test: `the fuse holds on the star's own time`.
2. **Points exactly on a target.** `byPoints` uses `>=`, so 1500 has passed ★★. The strip then shows ★★★ 2,700 with an empty bar, never a full ★★ bar. Task 2 test: `on the target the bar starts over`.
3. **A crash takes points back.** If the points fall below a star the rider had passed, the strip goes back to that star. The bar never shows more than the points. Task 2 test: `the strip follows points down`.
4. **The clock past the limit**, on the last frame before "Out of time": next is ★, the fill is 0 (never negative), and the fuse is red. Task 2 test: `past the limit`.
5. **The longest sign.** `● Hairpin Hollow ↕` with its hill icon must fit between the speed ring and the right-hand button column at 1180 px wide. Task 6 browser check: `the longest sign fits`.

---

## Stage 1: the riding HUD

### Task 1: Art: masters out of `public/`, small WebP files in

**Files:**
- Move: `public/ui/make/*` → `art/ui/sources/`, `public/ui/README.md` → `art/ui/README.md`, and the keyed `public/ui/{sign,star-gold,star-empty,cog,hill-up,hill-down,hill-both}.png` → `art/ui/keyed/`
- Create: `art/ui/build.mjs`
- Create (output): `public/ui/{sign-l,sign-m,sign-r,star-gold,star-empty,cog,hill-up,hill-down,hill-both}.webp`
- Test: `tests/ui-art.test.ts`

**Interfaces:**
- Produces: the nine files above at `/ui/<name>.webp`. `pieces.css` (Task 3) uses them.

- [ ] **Step 1: Write the failing test.** `tests/ui-art.test.ts` lists the nine names in its own `const ART`. For each name, assert with `statSync` that `public/ui/<name>.webp` exists and is ≤ 40 * 1024 bytes. Also assert that `public/ui` has no `.png`, `.jpg` or `make/` left.

- [ ] **Step 2: Run** `npm test -- tests/ui-art.test.ts`. Expected: FAIL (no `.webp` yet).

- [ ] **Step 3: Move the files.** Use `mv` as listed above, then update the paths inside `art/ui/README.md` (`public/ui/make/` → `art/ui/sources/`, saved results → `art/ui/sources/`).

- [ ] **Step 4: Write `art/ui/build.mjs`.**
  - It launches the same headless Chromium as `checks/energy.mjs` (same `BIN`, `--use-angle=swiftshader`, its own port, for example 9351) and does all pixel work in a page canvas.
  - It writes each output with `canvas.toDataURL('image/webp', 0.85)`.
  - **Commands:**
    - `node art/ui/build.mjs` builds everything from `art/ui/keyed/`.
    - `node art/ui/build.mjs key <in> <out.png>` runs the cut-out alone, for the parked postcards.
  - **Cut-out recipe**, used by `key` (copy it exactly). Per pixel:
    - `m = min(r,b) - g`
    - `a = 255 * (1 - clamp01((m - 50) / 110)) ** 1.6`
    - if `min(r,b) > g`, subtract `min(r,b) - g` from both r and b
    - trim to the bounding box of alpha > 24
  - **What the build does:**
    - **Stone star:** set every pixel's r, g and b to its luma `0.299r + 0.587g + 0.114b`, times 1.06 and clamped. This bakes in the mockup's `saturate(0) brightness(1.06)`.
    - **Sign** (1400×400): cut the left 165 px → `sign-l`, a 64 px slice from the exact middle → `sign-m`, and the right 165 px → `sign-r`. Each is scaled to 160 px tall.
    - **Sizes:** stars 160 px tall, cog 96 px tall, hills 160 px wide. Keep the aspect ratio.

- [ ] **Step 5: Run** `node art/ui/build.mjs`, then `npm test -- tests/ui-art.test.ts`. Expected: PASS. Look at `star-empty.webp` and make sure it is grey with no pink cast.

- [ ] **Step 6: Snapshot:** `"HUD art: masters to art/ui, small WebP set in public/ui"`.

### Task 2: The numbers: next-star strip, goal tag, medals, trick chips

**Files:**
- Modify: `src/game/targets.ts`
- Test: `tests/targets.test.ts` (uses its `FAKE` challenges: `fakeJumps` points [150, 1500, 2700] limit 30, `fakeLap` times [45, 15.4, 14.6])

**Interfaces:**
- Produces, all exported from `src/game/targets.ts`:
```ts
export interface Strip {
  kind: 'points' | 'time';
  next: 1 | 2 | 3;      // the star the bar is for (with full: the last one, won)
  full: boolean;        // points: all three won, bar stays full
  have: string;         // '2,449' (points, rounded down) or '12.3 s' (run.t)
  fill: number;         // 0..1: banked points from the last star toward next, or the fuse left
  open: number;         // 0..1: the open combo ahead of fill (points only); fill + open <= 1
  target: string;       // '1,500' or 'under 14.6'
  red: boolean;         // time: the ★ fuse in its last 10 s (and past the limit)
  left: number | null;  // points: whole seconds left, only when <= 10 s remain; time: null
}
export function nextStarStrip(goal: Goal, run: Run): Strip;
export function goalTag(progress: string): { text: string; pips: [number, number] | null };
export interface Medal { won: boolean; target: string; pays: number | null }
export function starMedals(goal: Goal, pays: { have: number; left: number[] }): Medal[];
export const COMBO_TIP = 'More tricks in one jump = bigger ×';
export function trickChips(goal: Goal): { where: string; chips: [string, string][] } | null;
export const fmtPoints: (n: number) => string; // Math.floor(n).toLocaleString('en-US')
```

- [ ] **Step 1: Write the failing tests.** Add `const strip = (id, at) => nextStarStrip(byId(id).goal, runOf(id, at))` and extend `runOf` to accept `banked` and `open`.

```ts
describe('the next-star strip, points', () => {
  it('starts empty toward ★', () => expect(strip('fakeJumps', {})).toEqual({ kind: 'points', next: 1, full: false, have: '0', fill: 0, open: 0, target: '150', red: false, left: null }));
  it('banked is solid, the open combo striped ahead of it, from the last star', () => {
    const s = strip('fakeJumps', { banked: 900, open: 300, points: 1200 });
    expect([s.next, s.target, s.have]).toEqual([2, '1,500', '1,200']);
    expect(s.fill).toBeCloseTo(750 / 1350); expect(s.open).toBeCloseTo(300 / 1350);
  });
  it('rounds points down', () => expect(strip('fakeJumps', { banked: 2449.6, points: 2449.6 }).have).toBe('2,449'));
  it('on the target the bar starts over', () => expect(strip('fakeJumps', { banked: 1500, points: 1500 })).toMatchObject({ next: 3, fill: 0, target: '2,700' }));
  it('the strip follows points down', () => expect(strip('fakeJumps', { banked: 1400, points: 1400 })).toMatchObject({ next: 2 }));
  it('after ★★★ it stays full', () => expect(strip('fakeJumps', { banked: 3000, points: 3000 })).toMatchObject({ next: 3, full: true, fill: 1, open: 0, target: '2,700' }));
  it('the red chip only in the last 10 s', () => {
    expect(strip('fakeJumps', { t: 19.9 }).left).toBeNull();
    expect(strip('fakeJumps', { t: 20.5 }).left).toBe(10);
    expect(strip('fakeJumps', { t: 31 }).left).toBe(0);
  });
});
describe('the next-star strip, time', () => {
  it('a full ★★★ fuse at GO', () => expect(strip('fakeLap', {})).toEqual({ kind: 'time', next: 3, full: false, have: '0.0 s', fill: 1, open: 0, target: 'under 14.6', red: false, left: null }));
  it('burns down', () => expect(strip('fakeLap', { t: 7.3 }).fill).toBeCloseTo(0.5));
  it('the fuse holds on the star\'s own time', () => expect(strip('fakeLap', { t: 14.6 })).toMatchObject({ next: 3, fill: 0 }));
  it('then refills for ★★', () => { const s = strip('fakeLap', { t: 14.61 }); expect([s.next, s.target]).toEqual([2, 'under 15.4']); expect(s.fill).toBeCloseTo((15.4 - 14.61) / 0.8); });
  it('★ burns to the limit, red for its last 10 s', () => {
    expect(strip('fakeLap', { t: 34.9 })).toMatchObject({ next: 1, target: 'under 45', red: false });
    expect(strip('fakeLap', { t: 35 }).red).toBe(true);
  });
  it('past the limit', () => expect(strip('fakeLap', { t: 46 })).toMatchObject({ next: 1, fill: 0, red: true }));
});
describe('goal tag', () => {
  it('five or fewer: pips', () => { expect(goalTag('Jumps 1/3')).toEqual({ text: 'Jumps', pips: [1, 3] }); expect(goalTag('Jumps 5/5')).toEqual({ text: 'Jumps', pips: [5, 5] }); });
  it('more: words', () => expect(goalTag('Gates 4/10')).toEqual({ text: 'Gates 4 of 10', pips: null }));
  it('anything else as it is', () => { expect(goalTag('To the top!')).toEqual({ text: 'To the top!', pips: null }); expect(goalTag('')).toEqual({ text: '', pips: null }); });
});
describe('medals', () => {
  it('points: won, then what each pays', () => expect(starMedals(byId('fakeJumps').goal, { have: 1, left: [90, 150] })).toEqual([
    { won: true, target: '150 points', pays: null }, { won: false, target: '1,500 points', pays: 90 }, { won: false, target: '2,700 points', pays: 150 }]));
  it('times', () => expect(starMedals(byId('fakeLap').goal, { have: 0, left: [45, 90, 150] }).map((m) => m.target)).toEqual(['under 45 s', 'under 15.4 s', 'under 14.6 s']));
  it('all won', () => expect(starMedals(byId('fakeLap').goal, { have: 3, left: [] }).every((m) => m.won && m.pays === null)).toBe(true));
});
describe('trick chips', () => {
  it('jumps, biggest first, from the game numbers', () => expect(trickChips(byId('fakeJumps').goal)).toEqual({ where: 'Off the jumps', chips: [['Backflip', '400'], ['360', '300'], ['No-hander', '200'], ['Tabletop', '150'], ['Hop', '50']] }));
  it('plank', () => expect(trickChips(byId('plank').goal)).toEqual({ where: 'On the plank', chips: [['Manual', `${TRICK_INFO.manual.points} a second`], ['Bunny hop', `${TRICK_INFO.bunnyhop.points}`]] }));
  it('timed: none', () => expect(trickChips(byId('fakeLap').goal)).toBeNull());
});
```

- [ ] **Step 2: Run** `npm test -- tests/targets.test.ts`. Expected: FAIL (`nextStarStrip` is not exported).

- [ ] **Step 3: Implement the exports** in `src/game/targets.ts`.
  - **Points:** `i = pts.findIndex((p) => run.points < p)`. When `i < 0` the strip is full. Otherwise `prev = i ? pts[i-1] : 0`, `fill = clamp01((run.banked - prev) / span)` and `open = clamp01((run.points - prev) / span) - fill`. The limit is `g.limit`.
  - **Time:** next is 3 while `t <= three`, then 2 while `t <= two`, else 1. The fuse runs over the segment: 0→three, then three→two, then two→limit. `fill = clamp01((end - t) / (end - start))`.
  - `trickChips` reuses the air list that `trickLines` builds today.
  - Leave `nextStarLive`, `starTargets` and `trickLines` in place. Tasks 6 and 7 remove them.

- [ ] **Step 4: Run** `npm test -- tests/targets.test.ts && npm run check`. Expected: PASS.

- [ ] **Step 5: Snapshot:** `"HUD: next-star strip, goal tag, medals and trick chips (pure)"`.

### Task 3: Shared pieces: sign, stars, cog, hill icons, strip, medals

**Files:**
- Create: `src/game/pieces.ts`, `src/game/pieces.css` (imported by `pieces.ts`)
- Modify: `src/game/hub/map.ts`. Its `COG` becomes `export { COG } from '../pieces'`, so `garage.ts`, `shop.ts` and `main.ts` keep importing it from `map`. Delete `:is(#hub, #lab) .cog` from `hub.css`.
- Test: `tests/pieces.test.ts`

**Interfaces:**
- Consumes: `Strip`, `Medal`, `fmtPoints` (Task 2); the art files (Task 1).
- Produces, from `src/game/pieces.ts`:
```ts
export function nameHtml(text: string): string;            // escapes, swaps every ↑ ↓ ↕ for a hill icon
export function starHtml(won: boolean): string;            // '<i class="ui-star won">★</i>' | '<i class="ui-star">☆</i>'
export const COG: string;                                  // '<i class="ui-cog">⚙</i>'
export function signHtml(titleHtml: string, symHtml?: string): string; // '<div class="ui-sign"><span class="t">{sym} {title}</span></div>'
export function stripHtml(s: Strip): string;
export function paintStrip(el: HTMLElement, s: Strip): void; // updates a stripHtml element in place, every frame
export function medalsHtml(medals: Medal[]): string;
export function mergeNames(names: string[]): string;
```

- [ ] **Step 1: Write the failing tests** (`tests/pieces.test.ts`):

```ts
it('hill icons keep the arrow as text', () => {
  expect(nameHtml('Goat Ladder ↑')).toBe('Goat Ladder <i class="ui-hill up">↑</i>');
  expect(nameHtml('Hairpin Hollow ↕')).toContain('<i class="ui-hill both">↕</i>');
  expect(nameHtml('Clear Goat Ladder ↑ and ↓ first')).toBe('Clear Goat Ladder <i class="ui-hill up">↑</i> and <i class="ui-hill down">↓</i> first');
  expect(nameHtml('A & <B>')).toBe('A &#38; &#60;B&#62;');
});
it('stars and cog', () => { expect(starHtml(true)).toBe('<i class="ui-star won">★</i>'); expect(starHtml(false)).toBe('<i class="ui-star">☆</i>'); expect(COG).toBe('<i class="ui-cog">⚙</i>'); });
it('merged names share their first words', () => {
  expect(mergeNames(['Table Row Big', 'Table Row XL'])).toBe('Table Row Big · XL');
  expect(mergeNames(['Table Row Medium', 'The Pump House', 'The Plank'])).toBe('Table Row Medium · The Pump House · The Plank');
  expect(mergeNames(['Goat Ladder ↑'])).toBe('Goat Ladder ↑');
});
it('strip: next star as icons, gold on time and when full, values as CSS vars', () => {
  const h = stripHtml({ kind: 'points', next: 2, full: false, have: '1,200', fill: 0.5556, open: 0.2222, target: '1,500', red: false, left: null });
  expect(h).toContain('data-next="2"'); expect(h).toContain('--fill:0.556'); expect(h).toContain('--open:0.222');
  expect(h.match(/ui-star"/g)?.length).toBe(2); expect(h).toContain('<b class="have">1,200</b>'); expect(h).toContain('<span class="target">1,500</span>');
  expect(stripHtml({ kind: 'time', next: 3, full: false, have: '0.0 s', fill: 1, open: 0, target: 'under 7.4', red: false, left: null }).match(/ui-star won/g)?.length).toBe(3);
});
it('medals: star, target, then pay with the cog or ✓ won', () => {
  const h = medalsHtml([{ won: true, target: '150 points', pays: null }, { won: false, target: '1,500 points', pays: 90 }, { won: false, target: '2,700 points', pays: 150 }]);
  expect(h.match(/class="ui-medal/g)?.length).toBe(3); expect(h).toContain('✓ won'); expect(h).toContain(`+90 ${COG}`); expect(h).toContain('1,500 points');
});
```

- [ ] **Step 2: Run** `npm test -- tests/pieces.test.ts`. Expected: FAIL (no module).

- [ ] **Step 3: Implement `pieces.ts`.**
  - The strip markup is `<div class="ui-strip {kind}[ red][ full]" data-next style="--fill:…;--open:…"><b class="have"></b><span class="bar"><i class="fill"></i><i class="open"></i></span><span class="next">{stars}</span><span class="target"></span></div>`. Format numbers with 3 decimals.
  - `paintStrip` sets the same vars and texts. It rebuilds `.next` only when `data-next` or `full` changes, and when it does, it adds `pop` (the star passed) or `drop` (the fuse ran out) for the animation.
  - A medal is `<div class="ui-medal[ won]">{stars for that tier: 1, 2 or 3}<span class="tgt">{target}</span><span class="pay">{+N COG | ✓ won}</span></div>`, inside `<div class="ui-medals">`.

- [ ] **Step 4: Write `pieces.css`.**
  - Art pieces are `display:inline-block`, with the background image, `color: transparent` and a size in `em`. `.ui-hill` is 2.1em wide (the spec says icons read at about 2× text height).
  - `.ui-sign` uses three backgrounds: `sign-l` left, `sign-r` right, and `sign-m` stretched between them to `calc(100% - 2 * var(--end))`. Its height is `--sign-h` (default 66px). `--end` is `calc(var(--sign-h) * .4125)`.
  - Strip: a dark pill. `.fill` is white, width `calc(var(--fill) * 100%)`. `.open` has yellow stripes and starts at `left: calc(var(--fill) * 100%)`. On a time strip `.fill` is the yellow fuse, and `.red` turns it red.
  - `pop` and `drop` keyframes (≈ .35 s).
  - Take sizes and colors from `hills-in-place-v5.html` and `tricks-trimmed.html`.

- [ ] **Step 5: Run** `npm test && npm run check`. Expected: PASS. Run `node checks/hub.mjs`. Expected: no new FAILs (the garage, shop and map cogs now show the cog art, and `⚙` is still in their text).

- [ ] **Step 6: Snapshot:** `"HUD: shared pieces (sign, star, cog, hill icons, strip, medals)"`.

### Task 4: Speed ring

**Files:**
- Create: `src/lab/speed-ring.ts`
- Modify: `src/lab/ride.ts:27` (`mph` moves to `speed-ring.ts`; `ride.ts` re-exports it), `ride.ts:129-134,381` (the ring replaces `<b class="mph">`), `src/lab/lab.css` (`.lab-read`)
- Test: `tests/speed-ring.test.ts`, `checks/game.mjs`

**Interfaces:**
- Produces:
```ts
export type Zone = 'pedal' | 'sprint' | 'hill' | 'over';
export interface SpeedT { cruise: number; sprint: number; maxSpeed: number }
export const SEGMENTS = 16;
export const SPEED_FULL: number; // Math.ceil(1.1 * max(DEFAULTS.maxSpeed, every BIKE_RIDE maxSpeed)) = 21 m/s today
export const ZONE_WORD: Record<Zone, string>; // pedal 'pedal', sprint 'sprint', hill and over 'hill speed'
export function speedZone(ms: number, t: SpeedT): Zone; // < cruise pedal, < sprint sprint, <= maxSpeed hill, else over
export function ringSegments(ms: number, t: SpeedT): { zone: Zone; lit: boolean }[]; // zone by segment midpoint; lit: i < round(clamp(ms/SPEED_FULL,0,1) * 16)
export function createSpeedRing(root: HTMLElement): { update(ms: number, t: SpeedT): void };
```

- [ ] **Step 1: Write the failing tests.** Use the hardtail: `HT = { cruise: 8.5, sprint: 11, maxSpeed: 15 }`.

```ts
it('full scale is a little over the fastest bike', () => { expect(SPEED_FULL).toBe(21); expect(SPEED_FULL).toBeGreaterThan(Math.max(...Object.values(BIKE_RIDE).map((r) => r.maxSpeed ?? 0))); });
it('zones from the bike', () => expect([8.4, 8.5, 11, 15, 15.01].map((v) => speedZone(v, HT))).toEqual(['pedal', 'sprint', 'hill', 'hill', 'over']));
it('segment colors', () => expect(ringSegments(0, HT).map((s) => s.zone).join()).toBe([...Array(6).fill('pedal'), 'sprint', 'sprint', 'hill', 'hill', 'hill', ...Array(5).fill('over')].join()));
it('lights in order, clamps at full', () => {
  expect(ringSegments(0, HT).filter((s) => s.lit).length).toBe(0);
  expect(ringSegments(10, HT).filter((s) => s.lit).length).toBe(8);
  expect(ringSegments(99, HT).every((s) => s.lit)).toBe(true);
  expect(ringSegments(10, HT).findIndex((s) => !s.lit)).toBe(8);
});
it('words', () => expect([ZONE_WORD.pedal, ZONE_WORD.sprint, ZONE_WORD.hill, ZONE_WORD.over]).toEqual(['pedal', 'sprint', 'hill speed', 'hill speed']));
```

- [ ] **Step 2: Run** `npm test -- tests/speed-ring.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it.**
  - `createSpeedRing` inserts `<div class="speed">` containing:
    - an SVG of 16 `<path class="seg {zone}">` arcs over 240° (open at the bottom),
    - `<b class="num">`, `<span class="unit">mph</span>` and `<small class="word">`.
  - `update` sets the `lit` classes, the number (`mph(ms)`) and the word (`ZONE_WORD[speedZone(ms, t)]`). It touches the DOM only when the lit count, the zones or the number changed.
  - **Colors** (`lab.css`): pedal green, sprint yellow, hill orange, over red. Unlit segments are their zone's color at about 30% opacity.
  - **Placement:** the ring sits top-left at about 150 px wide. `.lab-read` (now only `.jump` and `.dbg`) moves under it.
  - In `ride.ts`, replace `mphEl.textContent = …` with `speedRing.update(s.speed, T)`.

- [ ] **Step 4: Add a browser check** to `checks/game.mjs`, early, while free riding:
  - Read `s.speed`, `T`, the `.speed .seg.lit` count and `.speed .num` text in one `ev`.
  - Check that the lit count is within ±1 of `ringSegments(s.speed, T)` (import `/src/lab/speed-ring.ts` in the page) and the number is within ±2 of `mph(s.speed)`.
  - Check that `#lab .mph` is gone.
  - Take a screenshot (`05-speed-ring`).

- [ ] **Step 5: Run** `npm test && npm run check && node checks/game.mjs`. Expected: all PASS. Look at the screenshot.

- [ ] **Step 6: Snapshot:** `"HUD: segment speed ring"`.

### Task 5: Energy arc over the stick

**Files:**
- Modify: `src/lab/touch.ts:45` (markup: `<i class="fuel">` moves out of `.knob` and becomes a child of `.stick`), `touch.ts:99-106` (update the comment only; `--e`, `.low` and `.burnt` stay as they are), `src/lab/lab.css` (`.fuel`, `.word.up`)
- Test: `checks/energy.mjs`

- [ ] **Step 1: Write the failing check** in `checks/energy.mjs`, after "page up". Check that the arc is a child of the stick (not the knob) and sits over its top edge:

```js
const arc = await ev(`(() => { const f = document.querySelector('#lab .stick .fuel'), s = document.querySelector('#lab .stick').getBoundingClientRect(), r = f.getBoundingClientRect(); return { inKnob: !!f.closest('.knob'), above: r.top < s.top - 4, centered: Math.abs((r.left + r.right) / 2 - (s.left + s.right) / 2) < 3 }; })()`);
check(arc && !arc.inKnob && arc.above && arc.centered, `the energy arc sits over the stick, not under the thumb (${JSON.stringify(arc)})`);
```

- [ ] **Step 2: Run** `node checks/energy.mjs`. Expected: FAIL on that line.

- [ ] **Step 3: Move the markup and restyle it.**
  - `--e` keeps meaning "full tank = 360deg", so the existing checks read it unchanged. The arc shows `--e` scaled into 140° centered on top:
    ```css
    #lab .ctl .stick .fuel { --e: 360deg; position: absolute; inset: -18px; border-radius: 50%; pointer-events: none;
      background: conic-gradient(from -70deg, #ffd23f 0 calc(var(--e) * 140 / 360), rgba(31,42,51,.45) 0 140deg, transparent 0);
      mask: radial-gradient(circle, transparent 86px, #000 87px 97px, transparent 98px); }
    ```
    Add the `-webkit-mask` too.
  - Keep the `.low` (red) and `.burnt` (flashing) rules, re-pointed at the new selector.
  - Move `.word.up` ("faster") to `bottom: calc(100% + 30px)` so it clears the arc.

- [ ] **Step 4: Run** `node checks/energy.mjs`. Expected: all PASS. Look at `energy-low` and `energy-burnt`.

- [ ] **Step 5: Snapshot:** `"HUD: energy arc over the stick"`.

### Task 6: The run HUD: sign, goal tag, strip, Stop, 3-2-1 medals

**Files:**
- Modify: `src/game/main.ts:170-179` (overlay), `:403-450` (`startChallenge`, `stopRun`), `:486-497` (`frame`), `src/game/game.css` (`.banner`, `.count-goal` rules replaced)
- Modify: `src/game/targets.ts` (delete `nextStarLive`), `tests/targets.test.ts` (delete its tests)
- Test: `checks/game.mjs`, `checks/hub.mjs`

**Interfaces:**
- Consumes: `nextStarStrip`, `goalTag`, `starMedals` (Task 2); `signHtml`, `nameHtml`, `stripHtml`, `paintStrip`, `medalsHtml` (Task 3); `sym` (`map.ts`); `starPays` (`progress.ts`).
- Produces this DOM. The checks and later tasks rely on it:
  - `#lab .runhud` contains `.ui-sign`, `.tag` (with `.tag-t` and `.pips`), `.ui-strip` and `.chip-left`.
  - `#lab .b-stop` is a top-level button.
  - `#lab .count-medals` contains `.ui-medals`.
  - `body.in-run` is set from the start of the 3-2-1 to the end of the run.

- [ ] **Step 1: Write the failing checks.**
  - **`checks/hub.mjs`**, replacing lines 140-151 (countdown, banner, "longest banner fits"):
    - **During the countdown:**
      - `#lab .count-medals` is shown and has 3 `.ui-medal`. Its text includes `${N.small[i].toLocaleString('en-US')} points` for i = 0..2.
      - `#lab .runhud .ui-sign` text includes `Table Row Small`.
      - `.ui-strip` has `data-next="1"`.
      - `#lab .menu` is not shown.
    - **After GO:**
      - `.count-medals` is hidden.
      - `until` (8 s) `.runhud .tag-t` text is `Jumps` and `.runhud .ui-strip .target` text is `N.small[0].toLocaleString('en-US')`.
      - `#hud .score` is not shown.
    - **The longest sign fits.** Set `.runhud .ui-sign .t` innerHTML from the page's own `pieces.ts`: `'● ' + nameHtml('Hairpin Hollow ↕')`. Then check that `sign.left >= speed.right + 8` and `sign.right <= innerWidth - (speed.right + 8)`, using `#lab .speed` for the ring.
  - **`checks/game.mjs`:**
    - Every `#lab .banner .b-stop` becomes `#lab .b-stop` (lines 126, 179, 190, 209, 216).
    - During the first run, check that `.b-stop` is shown, its rect is in the top-right column (`right >= innerWidth - 40`, `top < 320`), and `#lab .menu` is hidden.
    - After Stop, check that `#lab .menu` is shown and `.runhud` is hidden.

- [ ] **Step 2: Run** `node checks/hub.mjs` and `node checks/game.mjs`. Expected: the new lines FAIL.

- [ ] **Step 3: Implement it in `main.ts`.**
  - **Overlay:** replace `.banner` and `.count-goal` with:
    ```html
    <div class="runhud" hidden><div class="sign-slot"></div><div class="tag"><span class="tag-t"></span><span class="pips"></span></div><div class="strip-slot"></div><span class="chip-left" hidden></span></div>
    <button class="b-stop" hidden>Stop</button>
    <div class="count-medals" hidden></div>
    ```
  - **When the countdown starts** (`startChallenge`):
    - fill the sign slot with `signHtml(nameHtml(def.name), sym(AREA))` and the strip slot with `stripHtml(nextStarStrip(def.goal, startRun(def)))`;
    - leave the tag empty;
    - fill `.count-medals` with `medalsHtml(starMedals(def.goal, starPays(me, def.id)))`;
    - show `.runhud` and `.count-medals`, and add `document.body.classList.add('in-run')`.
  - **At GO:** hide `.count-medals` and show `.b-stop`.
  - **`stopRun`:** hide `.runhud` and `.b-stop`, and remove `in-run`.
  - **`frame`:** while running, call `paintStrip(stripEl, nextStarStrip(g, run))`. Set the tag from `goalTag(status.progress)`. Pips are `●`×n then `○`×(total−n), and the tag hides while its text is empty. Show `.chip-left` with `${left} s` when `strip.left !== null`.
  - Delete `nextStarLive` and its tests.

- [ ] **Step 4: Style it in `game.css`.**
  - `.runhud` is centered at the top: the sign about 66 px tall, then the cream tag, then the strip (about 420 px wide), with the red `.chip-left` beside it.
  - `#lab .b-stop` goes at `top: calc(max(16px, env(safe-area-inset-top)) + 184px); right: 16px`, where the menu sits (the menu is hidden during a run).
  - `body.in-run #lab .menu, body.in-run #hud .score { display: none; }`
  - `#hud .combo` moves to `top: calc(max(16px, env(safe-area-inset-top)) + 168px)` (under the strip, and in the same spot in free ride). It becomes outlined white text: `-webkit-text-stroke: 3px var(--ink); paint-order: stroke fill`.
  - `.count-medals` sits under the 3-2-1 number (`top: 52%`). The medals use the card's cream on a translucent dark pill so they read over the world.
  - Delete the old `.banner` and `.count-goal` rules.

- [ ] **Step 5: Run** `npm test && npm run check && node checks/game.mjs && node checks/hub.mjs && node checks/energy.mjs`. Expected: all PASS. Compare the countdown and run screenshots against `tricks-trimmed.html`.

- [ ] **Step 6: Snapshot:** `"HUD: run sign, goal tag, next-star strip, Stop top right, 3-2-1 medals"`.

**Stage 1 checkpoint:** tell the user Stage 1 is ready to play on the iPad (`/play.html`), with the screenshots. Then carry on with Stage 2 unless they say to wait.

## Stage 2: ring card, list, result card

### Task 7: Ring card

**Files:**
- Modify: `src/game/hub/map.ts`. Add `ringCard`. Delete `goalLines` and `challengeRow`'s `tell` parameter.
- Modify: `src/game/main.ts:340-345` (`spotCard`, plus the click handler for `data-tab`)
- Modify: `game.css`/`hub.css` (`.ring`, `.ring-lock`, `.chips`, `.tabs`)
- Modify: `src/game/targets.ts`. Delete `starTargets`, `trickLines` and `COMBO`, and their tests.
- Test: `tests/cards.test.ts` (new; `map.ts` imports fine under vitest), `checks/game.mjs:107-117`

**Interfaces:**
- Consumes: `starMedals`, `trickChips`, `COMBO_TIP` (Task 2); `signHtml`, `nameHtml`, `medalsHtml` (Task 3); `lockText`, `starPays`.
- Produces: `export function ringCard(me: Profile, l: Loadout, defs: ChallengeDef[], pick?: string): string`. It returns the card's inner HTML, in this order:
  - When two or more challenges are open, `<div class="tabs">` with one `<button class="tab" data-tab="{id}">{nameHtml(name)}</button>` per open one.
  - For the picked open challenge (`pick`, else the first open one): `<div class="ring" data-c="{id}">`. Inside it go the sign, `<p class="tell">`, the medals, then (for point goals) `<div class="chips"><small>{where}</small>` with `<span class="chip">{name} <b>{value}</b></span>` per trick and `<p class="tip">{COMBO_TIP}</p></div>`, then `<button class="go primary">Go</button>`.
  - Each locked challenge: `<p class="ring-lock" data-c="{id}">🔒 {nameHtml(name)} <span>{nameHtml(lock)}</span></p>`.
  - Then `<div class="buttons"><button class="close">Not now</button></div>`.

- [ ] **Step 1: Write the failing tests and checks.**

```ts
// tests/cards.test.ts
const p0 = newProfile('A'), l0 = loadoutOf(p0), def = (id: string) => CHALLENGES.find((c) => c.id === id)!;
it('a locked second challenge is one line', () => {
  const h = ringCard(p0, l0, [def('goatUp'), def('goatBoth')]);
  expect(h.match(/class="ring" data-c="goatUp"/g)?.length).toBe(1);
  expect(h).toContain('class="ring-lock" data-c="goatBoth"'); expect(h).toContain('ui-hill both'); expect(h).toContain('Clear Goat Ladder');
  expect(h).not.toContain('class="tabs"');
});
it('two open: tabs, the first picked unless told', () => {
  const p = { ...p0, stars: { goatUp: 1, goatDown: 1 } };
  const h = ringCard(p, loadoutOf(p), [def('goatUp'), def('goatBoth')]);
  expect(h.match(/class="tab"/g)?.length).toBe(2); expect(h).toContain('class="ring" data-c="goatUp"');
  expect(ringCard(p, loadoutOf(p), [def('goatUp'), def('goatBoth')], 'goatBoth')).toContain('class="ring" data-c="goatBoth"');
});
it('point goals: chips and the tip; timed: none', () => {
  expect(ringCard(p0, l0, [def('tableSmall')])).toContain(`<p class="tip">${COMBO_TIP}</p>`);
  expect(ringCard(p0, l0, [def('goatUp')])).not.toContain('class="chips"');
});
```

  Then, in `checks/game.mjs`:
  - **Rewrite the Park card read** (lines 109-114) against `.card .ring[data-c="tableSmall"]`:
    - the medal targets equal `starMedals(goal, starPays(me, 'tableSmall')).map((m) => m.target)` (import `targets.ts` and `progress.ts` in the page);
    - the chip texts are `['Backflip 400', '360 300', 'No-hander 200', 'Tabletop 150', 'Hop 50']`;
    - `.tip` equals `COMBO_TIP`;
    - Go is inside the card, and the card fits the screen.
  - Change the click at line 117 to `.card .ring[data-c="tableSmall"] button.go`.

- [ ] **Step 2: Run** `npm test -- tests/cards.test.ts` and `node checks/game.mjs`. Expected: FAIL (`ringCard` is not exported, and the card lines fail).

- [ ] **Step 3: Implement `ringCard`.**
  - `spotCard(spot, pick?)` keeps the spot in `cardSpot` and calls `openCard(ringCard(…))`.
  - The click handler gets one more branch: `else if (el.dataset.tab) spotCard(cardSpot!, el.dataset.tab)`.
  - **CSS:**
    - The card's sign sits half over the card's top edge: `margin-top: calc(var(--sign-h) / -2 - 22px)`, with `--sign-h: 72px` on the card.
    - `.tell` is 23 px, weight 800.
    - Medals: three in a row.
    - Chips are small dark pills.
    - `.ring-lock` is one quiet line at 17 px.
  - Delete `starTargets`, `trickLines`, `COMBO` and `goalLines`, and their tests and imports.

- [ ] **Step 4: Run** `npm test && npm run check && node checks/game.mjs`. Expected: all PASS. Compare `47-park-card` against the ring card in `hills-in-place-v5.html`.

- [ ] **Step 5: Snapshot:** `"Cards: ring card with sign, big how-to, star medals and trick chips"`.

### Task 8: Area list: sign header, star slots, quiet merged locks

**Files:**
- Modify: `src/game/hub/map.ts` (`challengeRow`, `areaList`, new `areaHead`, `openArea`), `src/game/main.ts:337` (`areaHtml` uses `areaHead`), `src/game/hub/hub.css:59-73` (rows), `src/game/game.css` (`.sheet-head`)
- Test: `tests/cards.test.ts`, `checks/hub.mjs:97-103,120-123,175,184`

**Interfaces:**
- Consumes: `signHtml`, `nameHtml`, `starHtml`, `COG`, `mergeNames` (Task 3); `starPays`, `lockText`.
- Produces:
  - `areaHead(me: Profile, a: AreaDef, button: string): string` builds `<div class="sheet-head">{signHtml(esc(a.name), sym(a))}<span class="pill area-stars">{starHtml(true)} {n} of {m}</span>{button}</div>`. Both sheets use it: the map passes its ✕ close button, and the ride passes `Ride ▶`.
  - **Open row:** `<div class="row" data-c>` holds `<div class="what"><b>{nameHtml(name)}</b></div>`, then `<span class="meta">` with three `.slot` elements (won: `starHtml(true)`; not won: `starHtml(false)<small>{price}{COG}</small>`), then the replay pay as today when all three are won, then Go.
  - **Locked row:** `<div class="row locked" data-c="{first id}" data-cs="{all ids}"><b>{nameHtml(mergeNames(names))}</b><span class="lock">🔒 {nameHtml(lock)}</span></div>`. Within a group, locked challenges with identical `lockText` share one row. The row sits at the first one's place.

- [ ] **Step 1: Write the failing tests and update the checks.**

```ts
// tests/cards.test.ts (p0, l0 as in Task 7)
const park = AREAS.find((a) => a.id === 'mesaJumpPark')!, hills = AREAS.find((a) => a.id === 'shredderHills')!;
it('locked rows with the same lock share one row, in the first one\'s place', () => {
  const h = areaList(p0, l0, park);
  expect(h.match(/class="row[ "]/g)?.length).toBe(5);
  expect(h).toContain('data-cs="tableBig tableXL"'); expect(h).toContain('Table Row Big · XL');
  expect(h).toContain('Table Row Medium · The Pump House · The Plank');
  expect(areaList(p0, l0, hills).match(/class="row[ "]/g)?.length).toBe(7);
});
it('open rows: a slot per star, each empty one with its price and the cog', () => {
  const row = challengeRow(p0, l0, CHALLENGES.find((c) => c.id === 'tableSmall')!);
  expect(row.match(/class="slot"/g)?.length).toBe(3);
  for (const c of starPays(p0, 'tableSmall').left) expect(row).toContain(`<small>${c}${COG}</small>`);
});
```

Then, in `checks/hub.mjs`:
  - `starRow` now expects `☆${c}⚙` for each empty star: `'★'.repeat(won) + left.map((c) => '☆' + c + '⚙').join('')`.
  - The `rows` map reads `.meta` with `?.innerText ?? null`. The "every row" check (line 103) becomes "every open row".
  - **Hills sheet:** still 7 rows and 5 locked (no shared locks within a group).
  - **Park sheet:** 5 rows. The row whose name starts with `Table Row Medium` has the lock `🔒 Ride 2 ★` and name `Table Row Medium · The Pump House · The Plank`. A row is named `Table Row Big · XL` with `🔒 Ride 5 ★`. Locked rows have no `.meta`.
  - The sheet head shows `.ui-sign` with the area name, and `.area-stars` contains a `.ui-star.won`.
  - `parkHead.includes('★ 0 of 24')` stays (the star glyph is in the text).

- [ ] **Step 2: Run** `npm test -- tests/cards.test.ts` and `node checks/hub.mjs`. Expected: the new tests and the changed lines FAIL.

- [ ] **Step 3: Implement it.**
  - **CSS** (`hub.css` serves both sheets):
    - `.row.locked` gets a dashed 2px outline, transparent background and no stars.
    - `.slot` is an inline-flex column, with the star at about 30 px and the price chip under it.
    - The sheet head's sign has `--sign-h: 64px`.
    - Drop the old `.stars`, `.price` and `.cogs-for` rules. The existing `sheetSmall` check (nothing under 44 px) must still pass.

- [ ] **Step 4: Run** `npm test && npm run check && node checks/hub.mjs && node checks/game.mjs`. Expected: all PASS. Compare `82-sheet` and `82b-park-sheet` against the list in `hills-in-place-v5.html`.

- [ ] **Step 5: Snapshot:** `"Cards: area list with sign header, star slots and merged quiet locks"`.

### Task 9: Result card and failed card

**Files:**
- Modify: `src/game/main.ts:347,379-393` (`bigStars`, `showResult`), `game.css` (`.card .big-stars` → `.bigstars`)
- Modify: `docs/handoff-2026-11-01.md` (a short "HUD and cards" section)
- Test: `checks/game.mjs:96-101`, `checks/hub.mjs:161-166`

**Interfaces:**
- Consumes: `nextStarStrip`, `toNextStar` (Task 2); `signHtml`, `nameHtml`, `starHtml`, `stripHtml`, `COG` (Task 3).

- [ ] **Step 1: Update the checks.**
  - **`checks/game.mjs`, Cone Zone result:**
    - `.card .ui-sign` text includes `Cone Zone`;
    - `won` is the `.card .bigstars .ui-star.won` count;
    - `.bigstars` text is `'★'.repeat(won) + '☆'.repeat(3 - won)`;
    - `.card .ui-strip .have` matches `/^\d+\.\d s$/`;
    - `+${payOf(won)} ⚙` is still in the text, and the `.to-next` check is unchanged.
  - **`checks/hub.mjs`, Table Row Small result:**
    - `.bigstars` text is `★☆☆`;
    - `.ui-strip .have` is the points with commas;
    - `+${T1} ⚙`, `.to-next` and `.opened` are unchanged.
  - **Any failed run in the checks:** `.card h2` is the reason, and `.card .ui-sign` has the name.

- [ ] **Step 2: Run** `node checks/game.mjs && node checks/hub.mjs`. Expected: those lines FAIL.

- [ ] **Step 3: Implement it.**
  - **Finished:**
    - `signHtml(nameHtml(def.name), sym(AREA))`;
    - `<div class="bigstars">` with three `starHtml(i < stars)`;
    - the "New star!" line;
    - `stripHtml(nextStarStrip(def.goal, finished))` (frozen);
    - the `.to-next` and `.opened` lines (the opened line through `nameHtml`, not `esc`);
    - the cogs (with `COG`), then the buttons, unchanged.
  - **Failed:** the sign, `<h2>{why}</h2>`, `.how-close`, cogs(0), then the buttons.
  - Drop `.score` and the `!` after the name.
  - **CSS:** the sign is half over the card's top edge, as on the ring card. `.bigstars .ui-star` is 64 px.

- [ ] **Step 4: Run** `npm test && npm run check && node checks/game.mjs && node checks/hub.mjs && node checks/energy.mjs`. Expected: all PASS. Look at `46-result` and `86-result`.

- [ ] **Step 5: Write the handoff section.** In `docs/handoff-2026-11-01.md`, add 6–10 lines:
  - `pieces.ts`/`pieces.css` are the shared sign, stars, cog, hills, strip and medals, with the glyph-as-text rule;
  - `nextStarStrip` holds the one-star-at-a-time rule;
  - `speed-ring.ts` covers the zones and the full scale;
  - `art/ui/build.mjs` builds the art, including the `key` command for the postcards;
  - the energy arc keeps `--e` at "360deg = full".

- [ ] **Step 6: Snapshot:** `"Cards: result and failed cards with sign, star art and the frozen strip"`.
