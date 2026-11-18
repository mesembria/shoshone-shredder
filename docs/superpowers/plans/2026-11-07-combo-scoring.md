# Combo Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Park point challenges score combos the way free ride does (banked `comboTotal`s plus the open combo at the finish), with targets re-tuned so 3★ needs chaining combos across jumps.

**Architecture:**
- One helper in `src/game/challenges.ts` turns the bike's combo state into the `Tick` fields. The ride (`src/game/main.ts`) and the robots (`checks/ladder-robots.ts`) both use it, so they can't drift apart.
- `tick()` keeps a banked sum and an open total.
- The robots get a style that manuals from each landing to the next lip, and the six point targets are set from a full Park sweep.

**Tech Stack:** TypeScript 5.6, Vitest 2.1, vite-node (robots), headless Chromium over CDP (browser checks).

**Spec:** `docs/superpowers/specs/2026-11-07-combo-scoring-design.md`

## Global Constraints

- Scoring = `comboTotal` (points × max(1, count), `src/rules/tricks.ts`). No change to trick values, the multiplier, the bank rule (`BANK_AFTER`) or physics.
- Only the six point challenges change: `tableSmall`, `tableMedium`, `tableBig`, `tableXL`, `whoop`, `plank`. Timed challenges and free ride don't change.
- Ladder rule, verbatim:
  - (a) bare hardtail 1★, never 2★
  - (b) hardtail with all parts 2★, never 3★
  - (c) matching bike stock, careless, never 3★
  - (d) matching bike with parts, ridden well, 3★ just reachable
  - The matching bike for Park is the dirt jumper.
- 3★ is set from the chaining style. On (d), big airs banked jump by jump reach 2★ at most.
- Anti-goal stop: if the manual-between-jumps robot can't ride a line reliably (it can't pop out of a manual, or only a fluke finishes), stop. Bring the robot table to the user. Don't set 3★ from it.
- No `.git` in the project. Snapshot with `GIT_DIR=$PWD/.superpowers/sdd-git GIT_WORK_TREE=$PWD git add -A src tests checks docs && GIT_DIR=$PWD/.superpowers/sdd-git GIT_WORK_TREE=$PWD git commit -m "<msg>"`.
- Dev server at `http://127.0.0.1:5173`. Never run a robot sweep and a browser check at the same time.

## Review Focus

1. **A free-ride combo carried into a ring must not count.** Starting a challenge clears the combo (Task 1, browser line `a combo ridden in doesn't count`).
2. **The jump that finishes the run.** `count` reaches the goal on that landing, before any bank. Its tricks are in the open combo and must count (Task 1 test `the open combo at the finish counts`).
3. **The Plank's end line crossed during a manual.** The open combo counts (Task 1 test, plank variant).
4. **Robots and the ride build the same `Tick`.** A robot that still sends `points` would score 0 without anyone noticing (Task 1: the robots use `trickTick`; Task 3's sweep shows non-zero points for every trick style).
5. **The hub check's fake tricks land in the 1★ band** under the multiplier. `driveLane` adds `count + 1` per air, so it must not land 2★ by accident (Task 3 step: re-derive `trick` from the new targets).

---

### Task 1: Challenges count combos

**Files:**
- Modify: `src/game/challenges.ts` (`Tick`, `Run`, `startRun`, `tick`; new `trickTick`)
- Modify: `src/game/main.ts` (the `step` hook ~127-145, `startChallenge`)
- Modify: `checks/ladder-robots.ts:425-431` (build the Tick with `trickTick`)
- Test: `tests/challenges.test.ts`, `checks/hub.mjs` (one line)

**Interfaces:**
- Produces:
  - `trickTick(banked: number | undefined, combo: Combo): { bank: number; open: number }`. `bank` is `banked ?? 0`; `open` is `comboTotal(combo)`.
  - `Tick` loses `points` and `banked`, and gains `bank?: number; open?: number`.
  - `Run` loses `risk` and gains `banked: number`. `run.points` is always `run.banked + open` (the last `open` seen).
- Consumes: `comboTotal`, `EMPTY_COMBO`, `type Combo` from `src/rules/tricks.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/challenges.test.ts`.
  - Rewrite the `land(points)` helper as `land(open = 0, bank = 0)`, so a landing step can carry an open total and a bank.
  - Update the existing jumps and plank tests to the new fields, keeping their meaning (the stars thresholds stay the same in the synthetic defs).
  - New tests:
    - `points are banked combo totals plus the open combo`: `[{dt:1, open:300}, {dt:1, bank:300, open:0}, {dt:1, open:200}]` gives `run.points === 500`.
    - `the open combo at the finish counts`: with `tables` (count 2, points [100, 300, 800]), `[land(0, 0), land(450)]` gives `{ state: 'done', stars: 2 }`. The 450 is never banked.
    - Plank variant: `[{dt:1, plank:'on'}, {dt:1, open:120}, {dt:1, plank:'end', open:160}]` with `plank` [40, 100, 250] gives 2★.
    - `trickTick(undefined, {points: 450, count: 3})` gives `{ bank: 0, open: 1350 }`. `trickTick(900, EMPTY_COMBO)` gives `{ bank: 900, open: 0 }`.
- [ ] **Step 2: Run** `npx vitest run tests/challenges.test.ts`. Expected: FAIL (`trickTick` is not exported; `points` is NaN or doesn't add up).
- [ ] **Step 3: Implement.**
  - **`tick`:** `run.banked += k.bank ?? 0; run.open = k.open ?? run.open; run.points = run.banked + run.open`. Keep `open` on `Run`. Drop the `risk` lines (a Park crash already returns `restart` before scoring).
  - **`main.ts` step hook:** build `k` with `...trickTick(ev.banked, s.combo)` in place of `points` / `banked`, and drop `lastCombo`.
  - **`startChallenge`:** set `s.combo = EMPTY_COMBO` at GO, just before `run = startRun(def)`.
  - **Robots:** same change at `ladder-robots.ts:427-430`, importing `trickTick`.
  - **`hub.mjs`:** right after "Table Row Small runs after the countdown", add `a combo ridden in doesn't count`: `window.__game.run().points === 0`. Before Go, also seed `window.__lab.s.combo = { points: 500, count: 3 }`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass, tsc silent.
- [ ] **Step 5: Snapshot:** `Combo scoring in challenges`.

### Task 2: Text that matches the scoring

**Files:**
- Modify: `src/game/targets.ts` (`trickLines`, `nextStarLive`)
- Modify: `src/game/main.ts` (`showResult` score and line order, `handle` unlock)
- Test: `tests/targets.test.ts`, `checks/game.mjs:105`

**Interfaces:**
- Consumes: Task 1's `run.points`.
- Produces: `nextStarLive` timed form `★★★ in N s`.

- [ ] **Step 1: Write the failing tests** in `tests/targets.test.ts`.
  - Switch the format tests to synthetic defs, so Task 3's new targets don't break them. Make a `jumps` def with points [150, 1500, 2700] and a `lap` def with times [45, 15.4, 14.6], and check the same strings as now.
  - Jump trick line: `'Backflip 400 · 360 300 · No-hander 200 · Tabletop 150 · Hop 50'`, built from the constants.
  - Timed live, against the lap def:
    - t = 3: `'★★★ in 12 s'` (ceil(14.6 − 3) = 12)
    - t = 14.2: `'★★★ in 1 s'`
    - t = 15: `'★★ in 1 s'`
    - t = 16: `''`
  - Points live: points 900.7 gives `'900 → ★★ 1500'` (floor). Points 1499.6 gives `'1499 → ★★ 1500'`.
- [ ] **Step 2: Run** `npx vitest run tests/targets.test.ts`. Expected: FAIL on the trick line, the `in N s` lines and the floors.
- [ ] **Step 3: Implement.**
  - **Times:** `ceil(target − t)` while `t < target`.
  - **Points:** floor the shown points, but compare raw points against the targets.
  - **`showResult`:** the score uses `Math.floor(finished.points)`, and "New star!" comes before `.to-next` / `.opened`.
  - **`handle`:** capture `before = p` inside the `update` callback.
  - **`game.mjs:105`:** expect the new trick line, and read the targets string from the def (`import('/src/game/targets.ts')` / `CHALLENGES`) instead of hard-coding 150 / 1500 / 2700.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Snapshot:** `Star text matches combo scoring`.

### Task 3: Chaining robots and the new targets

**Files:**
- Modify: `checks/ladder-robots.ts` (`Style.chainManual`, the TABLES and WHOOP styles, the swipe logic ~403-415)
- Modify: `src/game/challenges.ts` (the six `points` arrays)
- Modify: `checks/hub.mjs` (`driveLane` trick size), `docs/handoff-2026-11-01.md` (ladder table and a section)

**Interfaces:**
- Consumes: Task 1's robot Tick. The real manual rule in `bike.ts:583-591`: a ground swipe ↓ starts a manual of up to 3 s, adds one trick to the combo, and blocks the bank while it lasts.

- [ ] **Step 1: Add the style.**
  - Add `chainManual?: boolean`. When it's set, after a landing (grounded, and the last air was off a lip) and while `s.manual <= 0`, swipe `'down'` to start a manual. Stop re-swiping once the bike is on the takeoff ramp (`s.slope > 0.15`), so the pop still happens.
  - Add, ridden well:
    - TABLES: `sprint, pop, as many tricks as fit, manual between` (`trick: 'best', chain: 4, chainManual: true`)
    - WHOOP: `pops, pumps, as many tricks as fit, manual between` (`pump: true`, `chainManual: true`)
  - The plank styles already manual; leave them.
- [ ] **Step 2: Check the style rides.**
  - Run `ONLY=tableSmall,whoop LOAD=d VERBOSE=1 npx vite-node checks/ladder-robots.ts`.
  - Expected: the chaining style finishes most of its tries, and scores clearly above the same style without `chainManual`.
  - If it can't pop out of the manual or rarely finishes, try releasing earlier (at a set distance before the lip). If it still fails, **stop**: give the user the table (anti-goal).
- [ ] **Step 3: Full Park sweep.** Run `GROUP=park npx vite-node checks/ladder-robots.ts`. Keep the log in the workspace.
- [ ] **Step 4: Set the six targets** from the sweep by the ladder rule.
  - 1★ at or below (a).
  - 2★ above (a), at or below (b), and above everything (c) reaches.
  - 3★ above (b), (c) and the non-chaining best on (d), and at or below the chaining (d).
  - Round to 50s or 100s, with a margin like the old ones.
  - Rerun the sweep. Expected: `rule: holds` on all six (Cone Zone's known break stays).
- [ ] **Step 5: Fix the hub check's fake tricks.**
  - Re-derive `driveLane`'s per-air `trick` so three faked airs (each `count + 1`, banked per jump) total between the new 1★ and 2★ for Table Row Small.
  - Run `node checks/hub.mjs` and `node checks/game.mjs`. Expected: no FAIL.
- [ ] **Step 6: Handoff and snapshot.**
  - Update the ladder table rows for the six challenges, with "*" marking the changed rows.
  - Add a short "Nov 7: combo scoring" section.
  - Snapshot: `Combo scoring: chaining robots and new Park targets`.
