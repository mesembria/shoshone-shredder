# Stay on the trail (Nov 13 2026)

A short design. Approved by: the user, Nov 14 2026.

## Why

In the Nov 13 playtest, Henry cut straight down the hillside on Hairpin Hollow ↓ and got 3★ easily. Timed runs only
check a start line and a finish line, so anything in between counts. The shortcut robot (`checks/hairpin-cut.ts`) agrees:
Hairpin ↓ is 66 m in a straight line against 250 m of trail, 6.65 s against a 3★ of 31.5 s. Hairpin ↑ can be cut the
same way (9.48 s against 63 s). Goat Ladder ↑/↓ couldn't be cut by the robot, and on Boulder Dash the cut is slower than
the trail.

## The rule a kid can say back

**"Stay on the trail. Cut it and you crash, back where you left it."** It holds on every timed run (Trail and Downhill),
in every area, and needs nothing placed by hand.

## Goals, non-goals, anti-goals

- Goal: no time gain from leaving the trail on any timed run, now or in future areas.
- Goal: honest riding never trips it: riding the edge, the grass band, a wide line in a switchback, a tumble off the edge,
  turning round on Hairpin's top platform.
- Non-goal: free ride. Off a timed run, the hill stays open to explore.
- Non-goal: Cone Zone keeps its own gates (`goal.kind: 'gates'`) as they are.
- Anti-goal: a crash the kid can't explain. The callout has to say why, on the same frame.
- Anti-goal: a rule judged only at the finish ("you only rode 60%"). It's judged live, where the cut happens.

## Approaches considered

1. **Flags in order (Cone Zone way)**: a flag pair at each switchback, a yellow arrow over the next one, and the finish
   counts only once all are passed. The kids already know it from Cone Zone and can see it. But each trail needs flags
   placed by hand, and it only covers the places someone thought to flag. The user first picked this, then preferred 3.
2. **Share of the trail ridden (e.g. 75%)**, judged at the finish: dropped. 75% of Hairpin ↓ lets you skip 62 m, a leg
   plus a switchback, about 6–7 s against a 2.75 s gap from 2★ to 3★. And a kid only learns of it at the finish.
3. **Picked: track progress along the run's route, live, and treat a skip as a crash.** It's automatic for every run,
   forgives honest excursions, and the callout comes at the spot of the cut.

## The design

- **A route per timed run**: the chain of trail stretches the run follows, in riding order, built where the runs are
  built (`src/world/places/hill.ts`, `Course['runs']`). For example: Hairpin ↓ is the hairpin trail from its top mark to
  its bottom mark, ridden in reverse. Hairpin ↕ is bottom to top, then top back to bottom. Goat Ladder ↕ is the climb from
  its start to its top, then the descent to its foot.
- **Progress**: while a run is on (after its start line), the game tracks how far along the route the rider has got. The
  rider counts as on the route within the trail's half width plus about 2 m of it.
- **A cut**, either of two ways (the user's idea, the first, catches a cut early, near where it began; the second
  catches what the first can't):
  - **Off the route for about 10 m of riding** (distance ridden since leaving it, not straight-line distance). Henry's
    cut down the hillside crashes a few metres in, not at the bottom.
  - **Back on the route more than about 10 m further along than the furthest point reached.** Where the trail doubles
    back, pieces of it run close together: just before a Hairpin switchback the two legs are about 4 m apart, so
    crossing between them is a few metres of grass (or none, within the tolerance) but skips about 15 m of trail, about
    1.5 s a switchback. Crossing the finish line counts as coming back at the route's end. Coming back where you left
    costs nothing.
- **What a skip does**: a real crash (the usual tumble and get-up penalties), with a callout on the same frame, "You cut
  the trail!". You get up on the trail at the furthest point you'd reached, facing along the route. The clock keeps
  running, like any crash on a Trail or Downhill run.
- **The ↕ runs' top line (`via`) goes**: the route already runs up and back down, so the top can't be skipped. The "To
  the top!" / "To the finish!" progress text and the "m from the top" how-close text come from route progress instead.

## Left to the builder

- The exact tolerances (lateral ~2 m past the trail's half width, ~10 m ridden off, skip ~10 m).
- Progress must follow the route in order: near a switchback the next leg is within reach of this one, and being on it
  is progress far along the route (a skip), not the same spot. Tune them with the robots: the ladder's
  trail riders and edge riders must never trip it, and every shortcut robot run must.
- How progress is found each step. It must stay cheap on the iPad: search near the last progress, never the whole trail
  (`docs/building-an-area.md`, "Speed on the iPad").
- How the crash is triggered from the game and sent to the right get-up spot (today `startCrash` is internal to
  `src/lab/bike.ts`, and getting up happens where you fell unless "Again" was pressed).
- Callout wording and sound, within the existing callout system.

## Verification

- `checks/hairpin-cut.ts` (`RUN=` each timed run): every cut that would have finished now crashes back, and no run gains
  time from cutting.
- `checks/ladder-robots.ts`: the same verdicts as before (14/15, Cone Zone the known break, the accepted Goat Ladder ↓
  edge case), with no skip ever tripped by a trail or edge rider.
- Tests for the route progress, the skip, the crash's get-up spot, and the ↕ runs without `via`.
