# Riding HUD, ring cards, list and result card: less to read, more character

## Why

During a challenge, everything the rider needs sits in one run-on banner:
`Goat Ladder ↓ · To the finish! · ★★★ in 5 s  38 s  Stop`. It's hard to read at a glance, and the yellow countdown
(`38 s`) confused the grown-up. It counts down to the **1★ cutoff** ("Out of time"). On Goat Ladder ↓ that's 40 s
while 3★ needs 7.4 s, so the number has nothing to do with what the rider is aiming for. A second countdown
(`★★★ in 5 s`) runs right beside it. Speed is plain `18 mph` text. The energy gauge, a ring round the stick's knob,
sits under the thumb, so an adult can't see it (the boys haven't complained). The ring card, the area list and the
result card have the same problem: star targets are a line of small text (`★ under 120 s · ★★ 45 s · ★★★ 38.5 s`) and
every row carries the same amount of detail.

Once the layout was calmer, the grown-up called it "vanilla" and wanted more character, made with Nano Banana art in
the map's clay-diorama style.

Everything below was chosen in the visual companion (mockups in
`.superpowers/brainstorm/40117-1794093037/content/`; the final ones are `tricks-trimmed.html` for the HUD layout and
`hills-in-place-v5.html` for the art in place).

## Goals

- Course name and goal on screen for the whole run, separate from the numbers.
- One thing to watch while riding: how close you are to the **next** star.
- Speed readable at a glance from its color and fill, not just a number.
- Energy visible around a big adult thumb.
- Ring card, list and result card readable at arm's length: big how-to, star targets as pictures, locked things quiet.
- More character: real art for the trail sign, stars, cog and up/down marks, in the clay style.
- The same pieces (sign, stars, strip) look and mean the same thing on every screen.

## Non-goals and anti-goals

- No change to scoring, star targets, time limits, pay or locks. This is presentation only. Numbers still come from
  `def.goal`, `TRICK_INFO`, `MOVE_INFO` and `starPays`, never typed in.
- No new buttons style. A clay-pill and a wooden-sign button style were mocked and rejected ("don't quite work"), so
  buttons stay as they are today.
- No help screen.
- Anti-goal: anything that makes the riding view busier. The first trick-course mockup showed all three star targets,
  their numbers, a dot, a clock and a points box at once, and the grown-up called it "very busy". The rule from that:
  **one star at a time**.
- Anti-goal: art that looks good but doesn't communicate. The first hill icons were pretty but unreadable at word size
  and had to be redone.

## Constraints

- iPad in landscape, held at arm's length, thumbs on the stick (bottom left) and Jump/Brake (bottom right). Top of the
  screen is the only free band.
- Plain DOM over the canvas, as today (`src/view/hud.ts`, `src/lab/ride.ts`, `src/lab/touch.ts`, `src/game/main.ts`).
- The project is not a git repo, and another session is rebuilding the trails. **Build after the trail rework has
  landed**; `src/game/main.ts` and `src/lab/ride.ts` are likely shared.
- Art files must be small enough for the iPads over wifi.
- Scope is `/play.html`. The older `/index.html` game also uses `src/view/hud.ts` (`createHud`); changes there must
  not break it, so put the new placement in the ride's own CSS or behind an option. *(My call.)*
- The area list exists twice in style: the ride's sheet (`src/game/game.css`) and the map's area sheet
  (`src/game/hub/hub.css`). Both get the new rows; they share `challengeRow`/`areaList` markup.

## Approaches

1. **Restyle the existing screens in place, in two stages.** Chosen. Stage 1 is the riding HUD, stage 2 is the ring
   card, the list, the result card and the hill icons everywhere a name appears. Each stage can be play-tested alone,
   and the HUD is what the boys look at most.
2. **New look behind a switch (`?hud=new`)**, the old look as default. Dropped: two looks to keep working, and
   nothing suggested the grown-up would want the old one back.

## The design

### Stage 1: riding HUD

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ╭speed╮        ╔══ ● Table Row Small ══╗              [🚲 Hardtail]   │
 │ │ 22  │          Clear 3 tables ●○○                      [Stop]       │
 │ ╰mph──╯    [ 2,450 ▓▓▓▒▒▒░░░░░░  ★★ 12,000 ]                          │
 │  sprint       Backflip + 360 + Tabletop ×3 = 2,550                    │
 │                                                                      │
 │   ◜energy◝                                                           │
 │  ( stick )                                          (BRAKE) (JUMP)   │
 └──────────────────────────────────────────────────────────────────────┘
```

**The sign (top center).** The wooden sign art with the area's symbol (`sym(AREA)`, ● for Shredder Hills) and the
challenge name, the up/down mark as a hill icon (Stage 2 adds the icons; Stage 1 can keep the arrow character). Under
it, a cream tag with the goal, taken from the run's progress: "Race to the bottom" / "To the top!" / "To the finish!",
and counts as pips when there are five or fewer ("Clear 3 tables ●○○", Whoop-de-Doo's five) or "Gate 4 of 10" when
there are more. *(Builder: reuse `status.progress`, reworded where it's a count.)*

**The next-star strip (under the sign).** One dark pill: `[have] [bar] [next star icons] [target]`. Only the next
star still in play is shown.

- *Points goals (jumps, plank):* `have` is the points, rounded down. The bar fills from the last star's points
  (0 before ★) to the next star's. Banked points are solid white; the open combo is yellow stripes ahead of them
  (landing turns them white, a crash drops them). When the points pass a star, that star pops gold and the bar starts
  over toward the next one. After ★★★, the bar stays full with three gold stars.
- *Time goals (gates, lap, run):* `have` is the clock **counting up** to one decimal. The bar is a yellow fuse that
  burns down over the time left for the star still in reach: from the start to ★★★'s time, then from there to ★★'s,
  then to ★'s (the time limit). The target reads like "★★★ under 7.4". When the fuse runs out, that star drops off
  (a small fall animation) and the fuse refills for the next one. The clock and fuse follow `run.t`, which starts at
  GO, the same clock the stars are judged on, even before a run's start line is crossed. *(My call: anything else
  would show a time the stars don't use.)*
- **The old countdown is gone.** On points challenges, a red chip `9 s` appears beside the strip only in the last
  10 s of the limit. On time challenges, the ★ fuse *is* the limit; it turns red for its last 10 s. *(My call: no
  separate chip on time challenges, because it would repeat the fuse.)*

**Combo line.** The trick names and multiplied total (`comboLine`) move from the very top of the screen to just under
the strip, as outlined text with no box, shown only while a combo is open. In free ride, where there's no sign or
strip, they sit in the same spot. *(My call, so it's always in one place.)*

**Speed ring (top left), replacing `18 mph`.** A 240° ring of 16 chunky segments that light up in order, with the
number and "mph" in the middle and the zone word under it. Lit segments are colored by what's moving you; unlit ones
show their zone's color, dimmed, so you can see what's ahead. Zones come from the bike's own numbers (they differ per
bike), *(my call)*: green up to `cruise`, yellow from `cruise` to `sprint`, orange from `sprint` to `maxSpeed`, red
above `maxSpeed`. Full scale is a little over the fastest bike's `maxSpeed` *(builder picks; the same scale on every
bike so a faster bike visibly fills more)*. The words under it: "pedal", "sprint", "hill speed". The jump readout and
debug lines that share `.lab-read` move under the ring or stay debug-only *(builder)*.

**Energy arc, replacing the ring round the knob.** An arc over the top of the stick's outer edge (about 140°,
centered on top, just outside the 160 px stick), where a thumb doesn't cover it. Same meaning and states as today's
`.fuel`: yellow full-to-empty, red when low, flashing when burnt. It moves with the stick (the stick can wander when
`stickFixed` is off). *(The boys liked it in the mockup.)*

**Buttons during a run.** Stop moves out of the banner to the top right, under Swap. Map and 📍 hide during a run
and the 3-2-1 (tapping Map mid-run drops the run anyway). Swap stays. The free-ride trick score (top right) hides
during a challenge, because the strip shows the challenge's points.

**The 3-2-1.** The sign and the strip, at rest (empty bar or full fuse), are already in place, so the run starts with
the HUD it will have. Under the big number, the three star medals (as on the ring card, below) replace the
`starTargets` text line, because Go on the map and Again skip the ring card. *(My call.)*

### Stage 2: ring card, list, result card, hill icons

**Hill icons everywhere a name ends in ↑ ↓ ↕.** `hill-up.png` (green arrow up), `hill-down.png` (orange arrow down),
`hill-both.png` (blue arch up and over). They replace the arrow character at the end of challenge names on the sign,
the cards, the list rows, lock lines ("Clear Goat Ladder [down hill] first") and `andNames` output. They have to be
drawn at about twice the text's height to read (at 1.5× the arrows can't be told apart). The name text stays in an
`aria-label`. *(Builder: one `nameHtml(name)` helper used by every screen.)*

**Ring card.**
```
        ╔═══ ● Goat Ladder [up] ═══╗
   Ride to the top. Save your legs for the steep bits.
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │   ★     │ │  ☆☆     │ │  ☆☆☆    │
   │ under   │ │ under   │ │ under   │
   │ 120 s   │ │ 45 s    │ │ 38.5 s  │
   │ ✓ won   │ │ +45 ⚙   │ │ +110 ⚙  │
   └─────────┘ └─────────┘ └─────────┘
                 [ Go ]
   🔒 Goat Ladder [both]   Clear Goat Ladder [down] first
                [Not now]
```
- The sign sits half over the card's top edge.
- `tell` in big type (about 23 px), first thing to read.
- Three medals: star art (gold for won, stone for not yet), the target ("under 45 s" or "12,000 points"), and what it
  pays (`+45 ⚙` with the cog art) or "✓ won".
- Point challenges add the trick values as small dark chips (Backflip **400**, 360 **300**, …) and one line, "More
  tricks in one jump = bigger ×", replacing the two-sentence `COMBO` text. *(The manual-after-landing hint is
  dropped from the card; the Jump button already shows it.)*
- A second challenge at the same ring: locked, it's one line with what opens it. Both open: two signs as tabs
  *(builder; no ring has two open challenges with the current locks often, so keep it simple)*.

**Area list** (the ride's 📍 sheet and the map's area sheet share `areaList`/`challengeRow`).
- The area name goes on the wooden sign in the sheet's header, so it reads as the trailhead board.
- Open rows: name (with hill icon), three star slots (gold for won; stone with the price and cog under each one still
  to win, as the grown-up asked for on Nov 7), and Go.
- Locked rows: no stars or prices, just a dashed outline with the name and what opens it, so open challenges stand
  out. Challenges with the same lock text sit on one row ("Table Row Big · XL").
- The "★ 3 of 45" pill uses the gold star art.

**Result card.**
- The sign over the top edge, then the stars won as big art (gold and stone), "New star!" when it is.
- The same strip as the ride, frozen where the run ended (e.g. `41.2 s ▬ ★★★ under 38.5`), then the existing
  `toNextStar` line ("2.7 s faster for 3 stars") and the cogs paid with the cog art.
- Failed runs: the sign, the reason as the headline ("Out of time"), `howClose`, and the buttons. *(My call; not
  mocked.)*
- Buttons unchanged.

### Art

All in `public/ui/`, made with Nano Banana from the prompts in `public/ui/README.md` (map as style reference, solid
magenta background, cut out afterwards). Sources are kept in `public/ui/make/`.

| File | What | Used |
|---|---|---|
| `sign.png` | blank wooden plank, bolts at both ends | stretched sideways (keep the ends, stretch the middle) for every sign |
| `star-gold.png`, `star-empty.png` | puffy gold star, stone star | every star on every screen |
| `cog.png` | brass chainring-cog coin | replaces the ⚙ glyph (`COG`) |
| `hill-up.png`, `hill-down.png`, `hill-both.png` | clay hill with a fat arrow | after challenge names |

Before shipping *(builder)*:
- **Bake, don't patch.** The stone star still has a pink cast: desaturate it in the file. The mockups hid it with a
  CSS filter.
- **Shrink.** `sign.png` is 1 MB; the icons are ~100–200 KB each. Export at 2× their largest display size, as WebP
  with alpha or compressed PNG.
- **Sign seam.** Stretching the sign with `border-image` showed faint vertical seams at the slice lines. Use three
  layers (left end, stretched middle, right end) or fix the slices.
- The cut-out recipe (headless Chromium canvas: alpha from how magenta a pixel is, a tightened edge, and despill
  pulling any magenta cast back to neutral) worked; keep it as a small script in `checks/` or `public/ui/make/` so
  the postcards can reuse it.

## Later (not in this build)

- **Challenge postcards**: an illustrated picture per course on the ring card and list rows, from a game screenshot
  plus the map as style reference. Parked until the trail rework lands (Goat Ladder's layout is changing). Prompt and
  screenshot method are in `public/ui/README.md` §3.
- Trail / Downhill / Park badges and a topo-map card texture.

## What's left to the builder

- Exact sizes, spacing and animation timings (star pop, star drop-off, combo stripes landing).
- How `.lab-read`'s jump readout fits once the mph text is gone.
- Where the HUD and card code lives: a strip/sign/medal set of small functions shared by the HUD, the 3-2-1, the
  ring card and the result card is expected.
- Updating the browser checks that read the old banner and knob ring: `checks/game.mjs` (`.banner .b-stop`),
  `checks/hub.mjs` (`.count-goal`, `.banner .b-text`, the "longest banner fits" check), `checks/energy.mjs`
  (`.stick .fuel`). Their intent carries over: Stop works, targets show before the run, the next star shows during
  it, the longest sign fits, energy shows and flashes when burnt.
