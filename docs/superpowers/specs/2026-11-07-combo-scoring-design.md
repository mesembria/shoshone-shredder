# Combo scoring in Park challenges

## Why

The boys didn't know combos multiply. When we added the star targets and trick tips, the final review found that
challenges don't multiply at all. A challenge adds up each trick's face value (`main.ts` sends the growth of
`s.combo.points`). The × only feeds the free-ride score in the corner. So the new tip ("More tricks before you land =
bigger ×. Manual after landing to keep it going!") taught a strategy that earns nothing, and a run showed two scores
that disagree. The user chose to make challenges count combos like free ride, and to make 3★ need chaining combos
across jumps (manual from a landing to the next lip). Chaining is the skill the boys don't know yet.

## Goals

- **One scoring rule everywhere.** A challenge's trick points are its banked combo totals (`comboTotal`, points × tricks)
  plus the combo still open when the run ends.
- **The numbers agree.** The banner, the combo line (`= total`), the corner score's `+bank` and the result card all
  match.
- **The six point challenges are re-tuned** with the robots: Table Row Small, Medium, Big and XL, Whoop-de-Doo and the
  Plank. The ladder rule still holds: (a) bare hardtail 1★, never 2★; (b) hardtail with all parts 2★, never 3★;
  (c) matching bike stock, careless, never 3★; (d) matching bike with parts, ridden well, 3★ just reachable. Matching
  bike for Park: the dirt jumper.
- **3★ needs chaining.** A new robot style manuals from each landing to the next lip, so one combo runs down the line.
  3★ is set from it. Big airs banked jump by jump reach 2★ at most on (d).
- **The tip stays and is now true.**
- **The review's leftovers, in the same pass:**
  - The timed banner counts down to the next star.
  - Shown points round down.
  - `Hop 50` goes in the jump trick list.
  - The unlock check uses the save's profile.
  - "New star!" shows before the 🔓 line.

## Non-goals and anti-goals

- No change to timed challenges (Pump House, Cone Zone, Trail, Downhill). No change to trick values, multiplier,
  bank rule or physics.
- No change to free ride.
- **Anti-goal:** 3★ that only a robot can get. If manualing between jumps can't be ridden reliably on a line (the robot
  can't hold a manual into a lip and still pop, or it only works on one bike by accident), stop and bring the numbers
  to the user. Don't set 3★ from a fluke.

## Approaches

1. **Count combos (`comboTotal`) in challenges, like free ride. 3★ needs chaining across jumps.** Chosen by the user.
2. **Count combos, 3★ from big airs banked jump by jump.** Easier stars, but chaining would earn nothing the stars ask
   for. Not chosen.
3. **Keep face-value scoring and change the words instead.** Two rules in one game. Not chosen.

## The design

**Scoring** (`src/game/challenges.ts`):
- `Tick` carries `bank` (the combo total banked this step, `ev.banked`, a number) and `open` (`comboTotal` of the
  combo still open after this step).
- `Run` keeps `banked` (the sum so far) and `points = banked + open` every step.
- Stars at the finish read `points`, so the last open combo counts.
- `risk` goes: a Park crash restarts the run, and Trail and Downhill don't score points.

**The ride** (`src/game/main.ts`):
- Builds `bank` and `open` from the bike state each step.
- Starting a challenge clears the combo, so a free-ride combo carried into the ring doesn't count.

**The robots** (`checks/ladder-robots.ts`):
- Build the same `Tick`. They import one helper from `challenges.ts`, so the robots and the ride can't drift apart.
- New style for the jump lines: after each landing, swipe ↓ to manual and hold it to the next lip. The manual ends on
  its own at takeoff or must be let go just before the lip, whichever the physics needs; the builder finds out. Then
  pop and do the best tricks that fit.
- Plank styles already manual. Re-run them under the new scoring.

**Targets:**
- Full Park sweep: `GROUP=park npx vite-node checks/ladder-robots.ts`.
- Set each `points: [1★, 2★, 3★]` from the robot table by the ladder rule. Round to tidy numbers (50s or 100s), with a
  margin like the old targets.
- Record the table in the handoff.

**Text:**
- **Trick line:** `Backflip 400 · 360 300 · No-hander 200 · Tabletop 150 · Hop 50`, from the constants. The Plank line
  doesn't change.
- **Banner, timed runs:** `★★★ in 12 s`. That's the whole seconds left to that star's time, counting down like the
  clock beside it. Then `★★ in N s`, then nothing.
- **Banner, points and result card:** shown points use `Math.floor`. Stars and gaps still compare the raw points.
- **`comboLine`:** shows the multiplied total as it does now. It now matches what the challenge counts.
- **Result card:** "New star!" comes before the 🔓 line. `newlyOpen` compares the save's profile before and after the
  payout (captured inside `update`).

## Left to the builder

- How the manual-between-jumps robot times its release and pop on each line, and whether the Plank's styles need a
  chaining variant.
- Tidy rounding of the new targets, within the ladder rule.
- Updating tests that hard-code today's targets (`tests/targets.test.ts`, browser checks reading `T1`/`N`) to read
  them from the challenge defs.
