# Star Targets and Trick Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show what each star needs before a run, the next star in reach during it, how far the run was from the next star after it, and what tricks are worth and that a combo multiplies.

**Architecture:** One new pure module, `src/game/targets.ts`, builds every new line of text from the challenge's `goal`, the `Run`, `TRICK_INFO` and `MOVE_INFO`. It is unit-tested. `src/view/hud.ts` `comboLine` gains the multiplied total. `src/game/main.ts` and `src/game/hub/map.ts` only place the text: on the ring card, the countdown, the banner and the result card. The browser checks confirm it on screen.

**Tech Stack:** TypeScript 5.6, Vitest 2.1, headless Chromium over CDP (`checks/hub.mjs`, `checks/game.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-07-star-targets-design.md`

## Global Constraints

- Words on screen only: no change to points, multipliers, star targets, the bank rule or `tick()`.
- Every number in the new text comes from code (`def.goal`, `TRICK_INFO`, `MOVE_INFO`), never typed into a string.
- No help screen, no tutorial.
- Star glyphs: `★`, `★★`, `★★★`; the separator is ` · ` (space, middle dot, space).
- Times print as the goal stores them (`String(n)`: `45`, `15.4`, `7.4`); a gap prints with one decimal.
- No `.git` in the project. Snapshot with `GIT_DIR=$PWD/.superpowers/sdd-git GIT_WORK_TREE=$PWD git add -A src tests checks docs play.html && GIT_DIR=$PWD/.superpowers/sdd-git GIT_WORK_TREE=$PWD git commit -m "<msg>"`.
- Browser checks need the dev server at `http://127.0.0.1:5173` (not localhost). Never run them during a robot sweep.

## Review Focus

1. **A time that displays as the 3★ target but missed it.** For example, 14.63 s shows as "14.6 s" but earns 2★. The result line must say `0.1 s faster for ★★★`, never `0.0 s` or a negative number (Task 1 test `gap never reads 0.0`).
2. **Points exactly on a target.** `byPoints` uses `>=`, so 1500 on Table Row Small is 2★. The banner then shows the 3★ target and the result asks for 1200 more, not 0 (Task 1 tests `on the target`).
3. **A crash mid-combo takes points back** (`run.points -= run.risk`). The banner reads `run.points` every frame, so it must fall back. If the points drop below a target already passed, the banner shows that target again (Task 1 test `banner follows points down`).
4. **Long banner names.** `Hairpin Hollow ↕ · To the top! · ★★★ by 112 s`, plus the seconds and Stop, must fit a 1180 px wide iPad (Task 2 browser check: banner width ≤ innerWidth − 32).
5. **Two challenges opening from one star.** The line must read `🔓 A and B are open!`, not two lines or `is open` (Task 1 test `two open at once`).

---

### Task 1: The text: targets, trick values, next star, combo total

**Files:**
- Create: `src/game/targets.ts`
- Modify: `src/view/hud.ts:7-11` (`comboLine`)
- Test: `tests/targets.test.ts` (new), `tests/hud.test.ts`

**Interfaces:**
- Consumes: `Goal`, `ChallengeDef`, `Run`, `CHALLENGES`, `canStart` from `src/game/challenges.ts`; `TRICK_INFO` from `src/rules/tricks.ts`; `MOVE_INFO` from `src/lab/bike.ts`; `Profile` from `src/game/progress.ts`; `Loadout` from `src/game/catalog.ts`.
- Produces (all in `src/game/targets.ts`):
  - `starTargets(goal: Goal): string`
  - `trickLines(goal: Goal): string[]` (empty for timed goals)
  - `nextStarLive(goal: Goal, run: Run): string` (empty string when there's nothing to say)
  - `toNextStar(goal: Goal, run: Run, stars: 1 | 2 | 3): string | null` (null at 3★)
  - `newlyOpen(before: Profile, after: Profile, l: Loadout, ids: string[]): string[]` (challenge names, in `ids` order)
  - `openedLine(names: string[]): string | null`
  - `comboLine(names, combo)` in `hud.ts` keeps its signature.

- [ ] **Step 1: Write the failing tests in `tests/targets.test.ts`**

Build `Run`s with `startRun(def)` and then set `t`, `points` and `count` directly. Look up each def by id from `CHALLENGES`.

```ts
// starTargets
expect(starTargets(byId('tableSmall').goal)).toBe('★ 150 · ★★ 1500 · ★★★ 2700 points');
expect(starTargets(byId('plank').goal)).toBe('★ 60 · ★★ 150 · ★★★ 280 points');
expect(starTargets(byId('pumpHouse').goal)).toBe('★ under 45 s · ★★ 15.4 s · ★★★ 14.6 s');
expect(starTargets(byId('coneZone').goal)).toBe('★ under 30 s · ★★ 14 s · ★★★ 12.5 s');
expect(starTargets(byId('goatDown').goal)).toBe('★ under 40 s · ★★ 10.6 s · ★★★ 7.4 s');

// trickLines: built from the constants, biggest first
const COMBO = 'More tricks before you land = bigger ×. Manual after landing to keep it going!';
expect(trickLines(byId('tableSmall').goal)).toEqual([
  `Backflip ${MOVE_INFO.flip.points} · 360 ${MOVE_INFO.spin.points} · No-hander ${TRICK_INFO.nohander.points} · Tabletop ${TRICK_INFO.tabletop.points}`, COMBO]);
expect(trickLines(byId('tableSmall').goal)[0]).toBe('Backflip 400 · 360 300 · No-hander 200 · Tabletop 150');
expect(trickLines(byId('plank').goal)).toEqual([`Manual ${TRICK_INFO.manual.points} every second · Bunny hop ${TRICK_INFO.bunnyhop.points}`, COMBO]);
expect(trickLines(byId('goatUp').goal)).toEqual([]);

// nextStarLive: points (tableSmall 150 / 1500 / 2700)
live('tableSmall', { points: 0 })      // → '0 → ★ 150'
live('tableSmall', { points: 900.4 })  // → '900 → ★★ 1500'
live('tableSmall', { points: 1500 })   // on the target → '1500 → ★★★ 2700'
live('tableSmall', { points: 2700 })   // → '2700 · ★★★!'
// banner follows points down: 1600 then a crash back to 1400 → '1400 → ★★ 1500'
// times (pumpHouse 45 / 15.4 / 14.6)
live('pumpHouse', { t: 3 })     // → '★★★ by 14.6 s'
live('pumpHouse', { t: 14.6 })  // → '★★★ by 14.6 s'
live('pumpHouse', { t: 15 })    // → '★★ by 15.4 s'
live('pumpHouse', { t: 16 })    // → ''

// toNextStar
next('tableSmall', { points: 640 }, 1)   // → '860 more points for ★★'
next('tableSmall', { points: 1500 }, 2)  // on the target → '1200 more points for ★★★'
next('tableSmall', { points: 1499.2 }, 1)// → '1 more point for ★★'  (rounded up, never 0; singular at 1)
next('pumpHouse', { t: 15 }, 2)          // → '0.4 s faster for ★★★'
next('pumpHouse', { t: 15.04 }, 2)       // → '0.5 s faster for ★★★'
next('pumpHouse', { t: 14.63 }, 2)       // gap never reads 0.0 → '0.1 s faster for ★★★'
next('pumpHouse', { t: 20 }, 1)          // → '4.6 s faster for ★★'
next('tableSmall', { points: 3000 }, 3)  // → null

// newlyOpen / openedLine (fresh profile from progress.ts; 'after' has tableSmall: 1)
expect(newlyOpen(fresh, oneStar, loadoutOf(fresh), AREAS[0].challenges)).toEqual(['Cone Zone']);
expect(newlyOpen(oneStar, oneStar, l, ids)).toEqual([]);
expect(openedLine([])).toBeNull();
expect(openedLine(['Cone Zone'])).toBe('🔓 Cone Zone is open!');
expect(openedLine(['Table Row Medium', 'The Pump House'])).toBe('🔓 Table Row Medium and The Pump House are open!'); // two open at once
expect(openedLine(['A', 'B', 'C'])).toBe('🔓 A, B and C are open!');
```

In `tests/hud.test.ts`, change the ×2 expectation to `'Bunny hop + Tabletop  200 ×2 = 400'` and add
`expect(comboLine(['Backflip', '360'], { points: 700, count: 2 })).toBe('Backflip + 360  700 ×2 = 1400')`. The one-trick
case stays `'Bunny hop  50'`.

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `npx vitest run tests/targets.test.ts tests/hud.test.ts`
Expected: FAIL. `targets.test.ts` can't resolve `../src/game/targets`; `hud.test.ts` gets `'Bunny hop + Tabletop  200 ×2'`.

- [ ] **Step 3: Implement `src/game/targets.ts` and the `comboLine` change**

- Index rule: for the next star `n = stars + 1`, both `points` and `times` arrays hold its target at index `stars` (`times[0]` is the 1★ limit).
- `nextStarLive` for points: the lowest target `> Math.round(points)`. For times: the 3★ target while `t <= times[2]`, else the 2★ target while `t <= times[1]`, else `''`.
- Points gap: `Math.ceil(target - points)`, at least 1; `point` when it is 1, else `points`. Time gap: `Math.max(0.1, Math.ceil((t - target) * 10 - 1e-6) / 10).toFixed(1)`.
- Point goals are `kind` `jumps` and `plank`; everything else is timed.
- `newlyOpen`: ids where `!canStart(before, def, l) && canStart(after, def, l)`, mapped to `def.name`.
- `comboLine`: with `count > 1`, append `` ` = ${Math.round(points * count)}` `` after the multiplier (the same total `comboTotal` banks).

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: every test passes (282 before this plan, plus the new ones). tsc prints nothing.

- [ ] **Step 5: Snapshot**

`GIT_DIR=... git add -A src tests && GIT_DIR=... git commit -m "Star targets: the text helpers and the multiplied combo total"`

---

### Task 2: Put it on screen: ring card, countdown, banner, result card

**Files:**
- Modify: `src/game/hub/map.ts:42-48` (`challengeRow`)
- Modify: `src/game/main.ts`: the overlay HTML (~160), `showResult` (~355), `startChallenge` (~368), `handle` (~406), `frame` (~458)
- Modify: `src/game/game.css` (countdown and card lines), `src/game/hub/hub.css` if `.row .tell` lives there
- Test: `checks/hub.mjs`, `checks/game.mjs`
- Docs: `docs/handoff-2026-11-01.md` (new top section)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: the DOM hooks the checks read: `.row .targets` and `.row .trick` (one `<small>` per `trickLines` entry) inside a ring card's open row, `#lab .count-goal` (name and targets during the countdown), `#lab .card .to-next` and `#lab .card .opened`.

- [ ] **Step 1: Write the failing browser checks**

`checks/hub.mjs`:
- At `84-countdown`: `#lab .count-goal` is shown and its text includes `Table Row Small` and `★ 150 · ★★ 1500 · ★★★ 2700 points`.
- Just after the run starts: the banner text includes `→ ★` and `#lab .banner` width ≤ `innerWidth - 32`.
- After that check: `count-goal` is hidden.
- On the 1★ result card (`86-result`): `.to-next` matches `/^\d+ more points? for ★★$/`. `.opened` reads `🔓 Cone Zone is open!` (the first star opens it).
- Long-banner check (Review Focus 4): call `window.__game.start('hairpinBoth')` with the stars set so it can start. If that's awkward, instead set the banner text to the worst case `Hairpin Hollow ↕ · To the top! · ★★★ by 112 s` through `.b-text` and measure. Either way, width ≤ `innerWidth - 32`.
- The mid-run "leave for the map" check later in the file: there is no `.to-next` on any failed card it sees.

`checks/game.mjs`:
- At the Cone Zone ring card (`coneCard`): it includes `★ under 30 s · ★★ 14 s · ★★★ 12.5 s` and has no `.trick` line.
- On the Cone Zone result card: either 3★ with no `.to-next`, or a `.to-next` matching `/^\d+\.\d s faster for ★★★?$/`.

- [ ] **Step 2: Run the checks to make sure they fail**

Run: `node checks/hub.mjs` and `node checks/game.mjs` (dev server up at 127.0.0.1:5173)
Expected: the new lines FAIL, because `.count-goal`, `.to-next` and `.opened` don't exist. The old lines still PASS.

- [ ] **Step 3: Implement**

- **`challengeRow`:** when `tell` is set and the row isn't locked, add `<small class="targets">` with `starTargets(c.goal)` after the tell line, then one `<small class="trick">` per `trickLines(c.goal)`. Map sheet rows (`tell` unset) stay as they are.
- **Countdown:** add `<div class="count-goal" hidden><b></b><span></span></div>` beside `.countdown`. `startChallenge` fills it with `def.name` and `starTargets(def.goal)` and shows it. It's hidden at GO. It sits below the number (`top` ≈ 62%), white with the same ink stroke as the countdown, and stays visible for the whole countdown (no pop animation).
- **Banner** (`frame`): `` `${run.def.name} · ${status.progress}` `` plus `` ` · ${live}` `` when `nextStarLive(run.def.goal, run)` isn't empty.
- **Result card:**
  - `showResult` takes one more parameter, `opened: string[]`.
  - On `done` it adds `<p class="to-next">` with `toNextStar(def.goal, finished, st.stars)` when that isn't null, and `<p class="opened">` with `openedLine(opened)` when that isn't null.
  - Failed cards don't change.
- **`handle`:**
  - Keep `const before = me` before `update`.
  - After paying with `newStars > 0`, compute `newlyOpen(before, me, loadoutOf(me), AREA.challenges)` and pass it on.
  - With `?bike=` (`quick`) or no new stars, pass `[]`.
- **CSS:** `.targets` and `.trick` are smaller than `.tell` (about 15 px against its size), on their own lines. `.trick` is muted. `.to-next` uses the `.how-close` colour, and `.opened` is bold green. The ring card must still show Go without scrolling at 1180×820. Check `43-spot-card` and a Table Row Small ring card screenshot.

- [ ] **Step 4: Run everything and make sure it passes**

Run: `npx vitest run && npx tsc --noEmit && node checks/hub.mjs && node checks/game.mjs`
Expected: all unit tests pass. hub.mjs has 159 + new lines with no FAIL, and game.mjs has 58 + new lines with no FAIL. Look at screenshots `84-countdown`, `86-result` and `43-spot-card` for overlap and clipping.

- [ ] **Step 5: Handoff section and snapshot**

Add a short `## Nov 7: star targets and trick points` section at the top of `docs/handoff-2026-11-01.md`:
- what shows where (ring card, countdown, banner, combo line, result card)
- that every number comes from `goal` / `TRICK_INFO` / `MOVE_INFO`
- the new test and check counts

Then snapshot: `GIT_DIR=... git add -A src tests checks docs && GIT_DIR=... git commit -m "Star targets on the ring card, countdown, banner and result card"`
