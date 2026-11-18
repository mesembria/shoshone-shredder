# Points come from lines over features

Short design. It follows on from `2026-11-07-combo-scoring-design.md` and replaces two patches made during its
final review (a flat hop adds no ×; a flat hop doesn't restart the bank clock).

## Why

The robots kept finding ways to score on the flat. Chained bunny hops never banked and multiplied (50·n², 430,000 on
Table Row Big). With that fixed, the no-handers that fit in each flat hop's air still beat the jumps. A manual on the
flat, over and over, would bank about 60 a second. Each patch was another special rule a kid can't guess. The user
asked for one model that can be understood, and chose this one for the whole game, free ride included.

## The model (the user's words, as approved)

- **Points come from features:** the jumps, the rollers, the plank.
- **A combo is one line.** It starts when you hit a feature. Every trick on that line counts and grows the ×.
- **The line keeps going while you're in the air off a feature or in a manual.** Roll for a second doing neither and
  it banks.
- **On flat ground with no line, nothing scores.** You can still hop and do tricks for fun.

## Goals

- One rule in the bike (`src/lab/bike.ts`), so free ride, challenges and robots all follow it.
- The ladder rule holds on the six point challenges with the hop robot (`hop chain guard`) left in the sweep.
- The card says it: the jump line leads with "Only tricks off the jumps score." The Plank's with "Only tricks on the
  plank score."

## Non-goals

- No change to trick values, the multiplier, physics or feel. The landing speed boost after a trick (`airPts`) stays
  as it is.
- The old prototype on `index.html` (`src/bike/controller.ts`) is not changed.

## How it maps to the bike (builder's calls)

- **A feature** is a lip launch (the existing `fromLip`, which covers jump lips and launches off rollers), or the
  `ramp` surface (the plank and the wooden kickers).
- **`s.line`** is true while a line is open:
  - It opens on a takeoff from a feature, or on a manual or hop on a `ramp` surface.
  - It closes when the combo banks, on a crash and on a reset.
- **Air:** `air.feature` records whether the air began on a feature.
  - Tricks and moves in that air add to the combo only if it did.
  - Air off a feature restarts the bank clock. Any other air (a flat hop, a roll-off) lets the clock run.
- **Hop:** it counts (50 and one more ×) only when it leaves from a feature. A flat hop scores nothing.
- **Manual:** it counts (+1 to the × and 60 a second) only while a line is open. A manual started on the plank opens
  the line.
- **Events:** a trick that didn't count sets `ev.off`. The combo line only names tricks that counted.
- **Tests:** the special-case `hopCombo` and its tests go.
- **Retune:** rerun the Park sweep and set the targets again where the numbers move (the Plank must move).
