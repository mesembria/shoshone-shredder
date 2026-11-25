# SDD ledger — plan: docs/superpowers/plans/2026-11-07-star-targets.md

Setup (updated Nov 24): real git repo now; work on a branch, commit normally, open a PR with `gh pr create`. Written when there was no `.git`; `.superpowers/sdd-git` snapshots are old history kept for reference.
Pre-flight: Task 2 consumes all of Task 1 targets.ts exports + comboLine; names match in both Interfaces blocks. No conflict.
Task 1: complete (commits d698560..e67e6df, tests: npx vitest run →    Duration  43.01s (transform 766ms, setup 0ms, collect 3.96s, tests 45.20s, environment 3ms, prepare 1.67s))
Task 2: Ruling: the combo line's "= total" is proven by the unit test only, not a browser check — the browser checks fake combos by writing s.combo, which never fires the trick event that redraws the HUD — if wrong: a break in hud.trick wiring goes unseen (that wiring is unchanged).
Task 2: Ruling: no failed-card browser line — showResult's failed branch is untouched and no hub.mjs path ends on a failed card — if wrong: low, the code path didn't change.
Task 2: Ruling: the long-banner check writes the worst-case text into .b-text and measures, instead of starting Hairpin Hollow ↕ — starting it needs a doctored save; the width is the same measure — if wrong: a different longest string could still overflow.
Task 2: complete (commits e67e6df..1591e78, tests: npx vitest run →    Duration  43.79s (transform 837ms, setup 0ms, collect 4.60s, tests 45.98s, environment 7ms, prepare 1.72s))
Bugfix (outside plan): crashed jumps count, Rhythm zone to x0+94 — tests challenges/spots RED→GREEN, suite 299/299, park robots unchanged.
Change (user request, outside plan): Park crash → restart from the start; crashed-jump counting reverted (unreachable now). Unit 300/300, game.mjs 67, hub.mjs 165, park robots best scores unchanged.
