# Star targets and trick points: show what each star needs

## Why

The boys don't know what a challenge's stars need until after they've ridden it. They know how to do tricks but not
which are worth the most, and they had no idea that tricks in one combo multiply. Nothing in the game says so: the ring
card shows only the name, the stars won, what each empty star pays and one sentence. The countdown is just 3-2-1-GO.
The result card shows the score and stars but not how far the run was from the next star.

## Goals

- Before a run: show what 1★, 2★ and 3★ need, wherever the run starts (ring card, map sheet Go, Again).
- During a run: show the next star still in reach.
- After a run: show how far the run was from the next star, and say so when a new star opens a locked challenge.
- Park challenges: show what each trick is worth and that tricks in one combo multiply, and that a manual keeps a combo
  going.
- Show the multiplied total in the combo line as it grows.

## Non-goals and anti-goals

- No help screen and no tutorial. Kids skip them.
- No change to points, multipliers, targets or the bank rule. This is only words on screen.
- Numbers come from the code (`goal`, `TRICK_INFO`, `MOVE_INFO`), never typed into text, so retuning stays honest.
- Keep it short. Each added line must fit on an iPad held in landscape and read at a glance.

## Approaches

1. **Cards only** (ring card and result card). Cheapest, but it says nothing during the run.
2. **Cards plus live hints during the run.** Chosen: the multiplier sinks in best when they see it happen in the air.
3. **A "How tricks score" help screen.** Dropped, because kids skip help screens.

## The design

**Star targets line**, from `def.goal`:
- Timed (gates, lap, run): `★ under 45 s · ★★ 15.4 s · ★★★ 14.6 s`
- Points (jumps, plank): `★ 150 · ★★ 1500 · ★★★ 2700 points`

**Trick line** (Park challenges whose goal is points):
- Jumps: `Backflip 400 · 360 300 · No-hander 200 · Tabletop 150` and then
  `More tricks before you land = bigger ×. Manual after landing to keep it going!`
- Plank: `Manual 60 every second · Bunny hop 50`, plus the same combo sentence.

**Ring card:** under each open challenge's `tell` line, add the targets line and, for Park point goals, the trick
line. Locked rows show the lock as they do today, with no targets.

**Countdown:** the challenge name and its targets line under the 3-2-1, because Go from the map sheet and Again both
skip the ring card. (My call: the countdown is the only screen every run passes through.)

**Banner during the run:** today it reads `Table Row Small · Jumps 1/3` and the seconds left. Add the next star still
in reach:
- Points: the lowest star above the current points: `Jumps 1/3 · 900 → ★★ 1500`. With all three passed: `★★★!`
- Timed: the best star the clock still allows: `To the finish! · ★★★ by 14.6 s`, then `★★ by 15.4 s` once 14.6 has
  passed, then just the time left as today.

**Combo line** (`comboLine` in `src/view/hud.ts`, shared with the lab): with two or more tricks it reads
`Backflip + 360  700 ×2 = 1400`. A single trick stays `Backflip 400`.

**Result card:**
- Done with 1★ or 2★: one line, `860 more points for ★★★` or `0.6 s faster for ★★★` (counting from this run's stars,
  not the saved best). For a time it shows one decimal, rounded up so it never says "0.0 s".
- Done with 3★: no extra line.
- Failed: as today (`howClose` already gives "120 of 150 trick points" or the distance left).
- When a new star opens one or more challenges in the area that were locked before: `🔓 Table Row Big is open!` (with
  the names joined if several). A lock it doesn't open isn't mentioned. (My call: cheap, and it answers "what's next".)

## Left to the builder

- Where the text helpers live (a small pure module beside `challenges.ts` is fine). Unit tests for them: each goal
  kind, the edges (points exactly on a target, a time past every star, 3★).
- Styling: the targets and trick lines are smaller than the `tell` text and must not push Go off the card.
- Extend `checks/hub.mjs` to see the targets on a ring card and the countdown, the next-star text on the result card and
  the multiplied combo line.
- Update the handoff doc with a short "Nov 7: star targets" section.
