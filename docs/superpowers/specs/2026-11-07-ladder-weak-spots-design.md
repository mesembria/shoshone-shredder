# Fixing the star ladder's weak spots (Nov 7, 2026)

## Why

The Nov 6 progression loop promises a star ladder: the bare hardtail gets 1★ and never 2★; the hardtail with all its
parts gets 2★ and never 3★; the matching bike ridden carelessly never gets 3★; the matching bike with its parts, ridden
well, can just reach 3★ ("Just getting the right bike shouldn't allow anyone to quickly get 3 stars. It should just
make it possible"). The robots found places where that breaks or where the course can't carry it (handoff, "Tuning
weak spots"). The user asked to fix them before the boys' playtest. Stars should mean bike + skill everywhere.

## Goals

1. **Cone Zone** separates bikes and riding: no 3★ decided by one frame.
2. **Boulder Dash**: a careless Enduro (stick up the whole way) no longer gets 3★; braking at the right place does.
3. **The Plank**: 3★ takes skill, not one 45 ⚙ part.
4. **Table Row XL and Whoop-de-Doo** open to every bike; their higher stars favor the Dirt Jumper.
5. **Hairpin Hollow ↓** is a real descent with jumps, so it belongs in Downhill and the trick boost works there.
6. With 2, 5 (and Goat Ladder ↓), every Downhill challenge has lips, so the trick boost isn't a one-trail feature.

## Non-goals

- The thin 2★ margins on Pump House, Goat Ladder ↕ and Hairpin ↑ (beyond what the Hairpin rebuild changes): wait for
  the boys' playtest.
- Prices, `PAY`, gear, crash costs (done Nov 7), new places.

## Anti-goals

- A crash the kid can't see coming: new boulders and the plank gap are marked ("ride the highlighted things": yellow
  lips and lip bars, rocks you can see from a distance).
- A challenge the hardtail can start but can't finish for 1★.
- Making Goat Ladder (the boys' favorite) worse: it is not touched.

## Approaches (picked by the user)

- **Boulder Dash.** Picked **A: boulders on the fast straight**: a step-down with a yellow lip, then big boulders
  staggered left and right on straight C, so the line swerves; at full speed you can't turn tightly enough, braking
  first gets you through. Rejected B, bending the chute round a berm: a rebuild, near the world's edge, and A gives
  the same lesson.
- **Hairpin Hollow.** Picked **A: the trail climbs a hillside**: every leg rises about 2 m (ridden ↑), the far end
  about 10 m up; ↓ is a real descent with braking before each hairpin, and two legs get a step-down with a lip for the
  ↓ direction. Cost accepted: Hairpin ↑ becomes a steady climb, longer and harder. Rejected B (only the climbing legs
  rise, ~5 m): ↓ would be half a descent.
- One sensible way for the rest: Cone Zone gets more, tighter gates; the Plank gets a gap; the Pop locks go.

## The design

**Cone Zone** (`course.ts` slalom; `coneZone` in `challenges.ts`)
- 10 gates instead of 6, closer together with a bigger side-to-side swing (start from about 6 m apart, ±2.5 m; the
  builder sets the final spacing from the robots). Still on the street, still alternating red/blue, the next-gate
  arrow as today. `count: 10`.
- Targets reset from the robots. Aim: at least about half a second between bare hardtail, full hardtail and the Dirt
  Jumper with parts, so 2★ and 3★ are not one frame apart.

**Boulder Dash** (`showcase.ts` Rock chute)
- On straight C: a step-down with a yellow lip and a line (`lines`, so line assist and `fromLip` work), then 2-3 big
  boulders staggered across the trail, taller than the Enduro can plow (plow is under 0.35 m), leaving one clear
  swerving line through.
- Lock unchanged (4★, Stable 5.9). Targets reset: careless stock Enduro (stick up) ≤ 2★ (it crashes, which now costs
  time, or has to slow); Enduro with parts ridden well (brakes before the boulders, tricks the step-down) 3★.

**Hairpin Hollow** (`showcase.ts` Switchbacks)
- Each of the five legs rises about 2 m ridden ↑ (keep a pitch or two steeper, and the gravel patch on leg 1); each
  hairpin turn is a flat pad at its leg's height, rocks round the outside and the boulder in the middle as today.
  Trail edges stay rock-lined. `Switchbacks top` moves up to the new top. The climb rules (legs set your pace,
  stalls, gravel) cover every leg now, not just legs 1 and 3, since every leg climbs (my call).
- Two legs get a step-down with a yellow lip facing the ↓ direction (ridden ↑ they are small steps up, which the climb
  rules already handle; the builder makes sure they're climbable, ledge-style, on the hardtail).
- ↑ / ↓ / ↕ start and finish lines as today; ↓ stays in Downhill and now gets the trick boost from its lips. All three
  targets reset from the robots; ↓ should need braking before the hairpins on every bike.

**The Plank** (`course.ts` `PLANKS[0]`, `createPlankWatch` in `spots.ts`, `plank` in `challenges.ts`)
- The narrow plank gets a gap of about 1.2 m halfway, both edges marked with lip bars. The wide plank stays whole, for
  practice.
- Over the gap in the air isn't "off"; landing in the gap (on the ground below) is "Fell off the plank".
- Hopping ends a manual (as today), so 3★ means: manual up to the gap, hop it, land, manual again. Scoring stays
  manual time plus the hop's points.
- Lock unchanged (2★, Flick 3.6). Size the gap so the full hardtail can clear it but has to give up the manual or
  ride faster before it (2★), and the Dirt Jumper can manual right up to it (3★). Targets reset from the robots.

**Table Row XL and Whoop-de-Doo** (`challenges.ts`)
- Drop the Pop 6 stat locks. Whoop-de-Doo keeps 4★. Table Row XL gets 5★ (like Table Row Big; my call, so it doesn't
  open on day one).
- Targets reset so the ladder holds: the hardtail can get 1★ (cleared, landing on the deck counts if that's all the
  hardtail can do), the full hardtail 2★ at most, the Dirt Jumper 3★. If the hardtail can't land XL at all, the
  builder brings it back rather than reshaping the table.

## Constraints

- Courses are code: `src/lab/course.ts`, `src/lab/showcase.ts`; runs keyed by challenge id; stations by name.
- Stat locks stay 0.15 clear of every reachable value (`tests/challenges.test.ts`).
- Targets come from `checks/ladder-robots.ts` (it needs new lines/styles: ten gates, the boulder swerve, the hairpin
  descent with step-downs, the plank gap hop). The older robots (`slalom.ts`, `showcase-robots.ts`) and the browser
  checks that drive Cone Zone (`game.mjs`) are updated to match.
- A full robot sweep is slow; never run it beside a browser check.
- No `.git` in the project; snapshots go to `.superpowers/sdd-git`.

## Left to the builder

Exact gate spacing, boulder sizes and places, step-down heights, the plank gap's length, the robot styles, and all
star targets, within the aims above. Update the handoff (weak spots list, ladder table, Nov 7 section).
