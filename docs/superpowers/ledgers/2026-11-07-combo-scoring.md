# SDD ledger — plan: docs/superpowers/plans/2026-11-07-combo-scoring.md

Setup (updated Nov 24): real git repo now; work on a branch, commit normally, open a PR with `gh pr create`. Written when there was no `.git`; `.superpowers/sdd-git` snapshots are old history kept for reference.
Pre-flight: T2 consumes T1 run.points (same name); T3 consumes T1 robot Tick via trickTick. No conflict.
Task 1: Ruling: also moved checks/showcase-robots.ts and checks/jump-lanes.ts onto trickTick — they built Ticks with the old points field and would silently score 0 (Review Focus 4) — if wrong: none, they're diagnostics.
Task 1: Ruling: the hub.mjs "a combo ridden in doesn't count" line is run in Task 3 step 5 with the rest of hub.mjs — its driveLane fake tricks need Task 3's new targets to land 1★ — if wrong: the line's first run is one task late.
Task 1: Ruling: test helper is land(open, bank) plus banks(n) = land(0, n) for the old per-jump meaning — keeps old tests' intent readable.
Task 1: complete (commits 1b218da..6203ea4, tests: npx vitest run →    Duration  42.52s (transform 798ms, setup 0ms, collect 3.81s, tests 44.50s, environment 4ms, prepare 1.44s))
Task 2: Ruling: hub.mjs countdown and banner lines now read the targets from the challenge (N.small) instead of 150/1500/2700 — Task 3 changes them — if wrong: none.
Task 2: Ruling: timed banner uses t < target (byTime uses <=), so at exactly the target time it shows the next star for one frame — harmless — if wrong: a one-frame flicker.
Task 2: complete (commits 6203ea4..9f015b4, tests: npx vitest run →    Duration  43.27s (transform 841ms, setup 0ms, collect 4.12s, tests 45.21s, environment 3ms, prepare 1.45s))
Task 3: Ruling: hardtail loadouts also ride the chaining style — manualing is a rider skill, not a part, and the ladder compares each loadout's best — if wrong: 2★ bands would be set lower than a non-chaining hardtail kid can reach.
Task 3: Ruling: Table Row Big and XL (one table) set 3★ from big airs, not chaining — nothing to chain to — if wrong: none.
Task 3: Ruling: added a small-pops chaining style to WHOOP — the big-pop chaining style flies off the line like its non-chaining twin — if wrong: none.
Task 3: Ruling: 1★ targets unchanged (150/150/200/200/300/60) — 1★ still means "clear it"; hub driveLane's fake airs (≤675) stay in the 1★ band, no change needed — if wrong: none.
Task 3: Ruling: Whoop 3★ 65000 against d 71208 with 42/72 finished — chaining on the doubles is hit-or-miss for the robot; 3★ "just reachable" — if wrong: Whoop 3★ may feel hard; playtest.
Task 3: Ruling: hub.mjs combo-ridden-in plant moved to the first countdown moment, checked in the same eval — the first run planted after GO (headless slowness) — if wrong: none.
Task 3: complete (commits 9f015b4..01797b0, tests: npx vitest run →    Duration  42.81s (transform 729ms, setup 0ms, collect 3.64s, tests 44.76s, environment 4ms, prepare 1.49s))
Final review: fresh reviewer (opus). Critical none. Important 2, Minor 5.
Final: fixed showcase-robots.ts ReferenceError (r.points += points after points was deleted) — reproduced RED (ReferenceError in 25 s run), GREEN (0 ReferenceError, rides print); suite 304/304 unchanged (checks/ not in vitest). Task 1 ruling "if wrong: none" was wrong.
Final: CONFIRMED Important — flat bunny hops chain the × (50·n²): PROBE style "hops on every flat" scores 221000 on Table Row Big with the bare hardtail (3★ vs 5500). Spec forbids changing trick values/bank rule, so this is the user's call — asked. PROBE styles left in TABLES and PLANK as a guard.
Final: fixed flat hops raising the × (user chose option 1) — hopCombo tests + labRide "chained flat hops ... never raise the multiplier" RED→GREEN, suite 308/308.
Final: NOT CLOSED — sweep3: guard style still scores 116000–430000 (Medium/Big/XL/Plank break). Cause: each flat hop's takeoff resets groundedFor, so the combo never banks, and a trick in each hop's air (no-hander) still adds a ×. Fix needs a bank-rule change (spec forbids) — asked the user.
Final: fixed flat hops holding a combo open (user approved: a flat hop doesn't restart the bank clock; its air counts) — labRide "flat hops do not hold a combo open" RED (0 banks) →GREEN (6 banks/6 s, ≤5 tricks), bankIfDue() also runs before a flat hop leaves on its landing step; suite 309/309.
Final: sweep4: guard down from 116k–430k to 10.5k–37k, but still breaks Medium/Big/XL (bare hardtail 10500–15750 from flat-hop no-handers banked ~1/s). Plank legit styles fell (b 446→223, c+ 873→291): its gap hop is a flat hop, so no ×; Plank needs a retune. Asked the user whether flat-hop air tricks count in jump challenges.
Final: user chose one model for the whole game, free ride included — "points come from lines over features" (spec docs/superpowers/specs/2026-11-07-lines-over-features-design.md). Replaces hopCombo and the flat-hop clock hold. labRide "points come from lines over features": flat hops/tricks and flat manual RED→GREEN; lip trick, manual after landing, ramp manual guards GREEN; suite 309/309. sweep5: rule holds on all six, guard no longer wins on Table Rows/Whoop. hub 166, game 67.
Final: Ruling: a feature = a lip launch (fromLip, covers rollers) or the 'ramp' surface (plank, kickers) — the only distinctions the bike already has; dirt jump faces and lanes share 'dirt' — if wrong: a feature without a lip or ramp surface wouldn't start a line.
Final: Ruling: the landing speed boost after a trick (airPts) still counts flat-hop tricks — the spec keeps feel unchanged — if wrong: none for scoring.
Final: Ruling: "Just for fun!" callout (at most every 10 s) when a trick scores nothing — the user asked for a model a kid can understand; silence would look like a bug — if wrong: one more callout to remove.
Final: Ruling: Plank 3★ 800 → 750 — the manual-and-gap line tops at 783 under the model; only hopping along the plank (3024) reached 800 — if wrong: 3★ slightly easier.
Final: Ruling: hopping along the plank scores (×) — it's on the feature, a real skinny skill; robot finishes 85/138 — if wrong: playtest may show it dominates the Plank.
Final: Ruling: old prototype (index.html, src/bike/controller.ts) not changed — the game is play.html — if wrong: index.html scores the old way.
Final: Ruling: Whoop 3★ 65000 evidence — whoop-d.log: 7 of 8 finishing chaining runs clear 65000 (70758–71208) — reviewer's weak-evidence note answered.
Final: minor (deferred): a failed card rounds 59.6 to "60 of 60 trick points" (main.ts:333/338, use Math.floor).
Final: minor (deferred): first combo line in a challenge can list free-ride trick names (ride.ts names not cleared at GO).
Final: minor (deferred): combo line rounds, banner floors; 5-digit targets without thousands separators.
Final: minor (deferred): hub "longest banner fits" check uses old wording (new longest is 48 chars vs 45 tested).
Final: minor (deferred): the timed banner and the clock tick at different moments (harmless).
Final: minor (deferred, earlier review): "360 300" readability; byTimes cast.
Review 2 (lines over features, 01797b0..8a00e8b): fresh reviewer (opus). Critical 1, Important 2, Minor 10.
Final: fixed CRITICAL freeze — a trick off any line called sound.trick(0) → SCALE[-1] → NaN → setValueAtTime throws, frame loop stops. game.mjs "a manual on the flat scores nothing and the ride keeps going" RED (TypeError, clock stuck) → GREEN; ride.ts skips the chime when ev.off, sound.trick clamps count ≥1. game 68/68.
Final: fixed IMPORTANT manual + flat hops grew the line (77k) — the hop scored by s.onLine, not by its air. scoreAir() (hop and air tricks: air.feature) / scoreManual() (onLine). labRide "flat hops inside a manual on a line add nothing" RED 16405 → GREEN ≤760; suite 310/310. Guard style "manual between, taps Jump on every flat" added to TABLES.
Final: Ruling: Plank hop-along compounds (each hop on the plank is a feature takeoff), 3–4 hops clear 750 — it's on the feature and the model says every trick on the line counts; bounded by the 12 m plank — if wrong: 3★ on the Plank is "hop along it", not "manual and hop the gap"; flagged to the user for playtest.
Final: Ruling: reviewer's "sweep5 header still 800" — the Plank was rerun at 750 (ONLY=plank, rule holds) before the commit; sweep6 reruns all — if wrong: none.
Final: minor (deferred): manual started off-line then a lip roll-off opens the line with count 0, manual points (≤180) carry into the next combo.
Final: minor (deferred): ev.off is one flag per step (a counted and an uncounted trick in one step mislabel).
Final: minor (deferred): "Just for fun!" fires on the Plank approach and during a live combo; every 10 s while flat-hopping in free ride.
Final: minor (deferred): rename s.onLine (clashes with air.line/Line jump geometry) — e.g. comboOpen; groundedFor now means "time since the line was fed".
Final: minor (deferred): comment at bike.ts LabEvents.off — air tricks in a flat hop are off even when a line is open.
Final: minor (deferred): test gaps — no dirt-lip (fromLip-only) test; no crash/warp mid-line test.
Final: minor (deferred): sweep summary prints only the best style per loadout, not the guard's own row; Plank guard's name is confusing as its 3★ route.
