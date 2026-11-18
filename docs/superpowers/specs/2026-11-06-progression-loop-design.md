# The progression loop, first thin slice: map, cogs, garage, shop (design)

Nov 6, 2026. Follows `2026-11-05-bike-rules-design.md` (bike rules, energy, wobble, showcase places). That doc's
"piece 3" (parts on a garage wall) is folded into this one.

## Why

The boys played the new bike rules and liked them, but the user's oldest "wrapped up playing pretty quickly". There is
nothing to chase: every bike is open, nothing is earned, nothing is spent. The user: "we need to start adding the
gameplay loop soon."

The loop the user wants: start on a basic bike in a few places, do challenges, earn currency, spend it on upgrades, a
new bike or gear, and open new places. The oldest "loves looking at bikes and specing them", so the bike itself has to
be worth looking at, in a garage built for admiring it, with real-looking specs. The game is personal: home is the
family's garage in Lafayette, and the places are real Colorado riding spots (built later).

This doc covers the whole loop as decided, then scopes the **first thin slice**: every part of the loop in a basic
form, built on the content we already have, so the boys get something to earn and spend as soon as possible. Later
projects deepen each part (listed at the end).

## Decided (by the user)

- **Home is a map.** An illustrated toy map of Colorado; Garage and Shop are places on it ("A, the map is home", from
  three mockups). Tap where you want to go. The neighborhood as home base comes later.
- **The map art is generated with Nano Banana** (Google's Gemini image model), toy style. The user makes the image and
  we iterate on prompts as areas are added (prompt at the end of this doc).
- **Map → area → trail.** You pick an area on the map, then a trail or run inside it. Places are not faithful copies:
  "you'd pick an area, and then select trails from it. So, we'd only need to work at the trail level, and could add
  over time."
- **Real Colorado places, later:** garage in Lafayette; Marshall Mesa (Doudy Draw, Springbrook; Doudy Draw is fully
  open to bikes) as the first local trail area; Valmont as the bike park; Trestle and Vail as downhill parks needing
  lift tickets, "just like real life".
- **This slice reuses the current test park, so it gets a made-up name**, not a real one: "don't use real place names
  if we're reusing our current test map. Create a new area, and just stick them there."
- **Start small:** one starter bike, and one park, one trail and one downhill to start.
- **The starter bike can finish everything it starts with,** at the basic level: "They can't get 3 stars or whatever
  we go with, but they can complete it as the basic level, enough to earn money to get more gear."
- **Upgrades come before the new bike:** "ideally, they need to upgrade the existing bike a time or two to be able to
  complete the challenges needed to get the real money to get a new bike."
- **Rewards smaller, challenges harder** than the old progression (which Henry finished in about 15 minutes); tuned
  over time.
- **The currency is cogs** (not bolts, not money: "You don't actually get money just for doing trails").
- **Keep every bike** you buy.
- **Parts are locked to one bike.** "If you buy a fork for the dirt bike, it only works with it. You need to buy a new
  fork for new bikes." Parts hang on the garage wall and swap on and off that bike freely (from the bike-rules doc).
- **Garage: tap the part on the bike, plus a spec sheet tab** ("B with A's spec sheet", from two mockups). The bike
  spins 360° on a stand; glowing dots on the fork, wheels, bars and gears; tap one for a card with the part on now,
  the parts on your wall and the shop's, and only the stats that part moves (green better, red stripes worse). A Specs
  tab shows the full spec sheet with real-looking numbers (mm, inches, kg). The shop reuses the same stand and sheet.
- **Challenge types:** Trail is a time trial. Downhill is time plus style, where **landed tricks give a short speed
  boost** (not seconds off: "same end outcome, but cooler"). Park (tricks) is trick points.
- **Trails run up, down, or both, plus combinations across trails** (up one, down another), each with its own goals
  and cogs. This multiplies what one trail build is worth.
- **Crashes cost time, not a restart:** pick up the bike, be winded; armor shortens it. (Later project; the slice
  keeps today's crash behavior.)
- **Gear is required on some harder trails** and also helps in crashes (helmet, chest armor; later project).
- **Bikes can be colored** ("we definitely need to allow for coloring bikes").
- **Maps for new places are both found and earned:** some found while riding (off the line, or only reachable over a
  certain jump), others earned from challenges. (Later project.)
- **Trail edges should match the real terrain** instead of rock lines everywhere: tall grass that slows you, a cliff on
  one edge, trees. (Later, when real trails are built.)
- **Approach A** (below): a thin version of the whole loop first.
- **Tune goes away** (after the builder check asked what happens to it once there's something to earn): "Get rid of
  tune. We can turn it back on in the experiment area once we have real areas in place."
- **3 stars are for the right bike, and still take skill:** "I am ok with the right bike, but skill has to be involved
  also. Just getting the right bike shouldn't allow anyone to quickly get 3 stars. It should just make it possible."
  A fully upgraded starter reaches 2★ but (almost) never 3★; the matching bike makes 3★ possible, not easy.
- **After reading the first draft, the user asked for, and approved:**
  - **Brakes as their own slot**: stopping power matters on the downhills (brake later and shorter, carry more speed).
  - **Tire compounds**: sticky (grip in corners, berms and gravel) vs fast-rolling (less rolling resistance, but
    slides out sooner).
  - **Geometry counts**: it belongs to the frame (slack and long = stable, wider turns, harder to flick; steep and
    short = quick steering, tight turns, playful), shown on the spec sheet; a few parts nudge it, as a longer fork
    or an angle-set headset does on a real bike.
  - **Fewer parts now, more later**: the slots are fixed now (the garage and the save are built round them), parts are
    data that can be added any time.
  - **Trails in the demo area get names**, as real areas will: "Those names are great." 

## Approaches considered

- **A. Thin whole loop first (picked).** Map, one made-up area built from today's content, cogs from challenges with
  tiers, a starter bike, a garage with the 360° stand and specs, a shop. Every piece basic, then deepened. Gives the
  oldest something to chase soonest; the cost is that the first area is a stand-in, not a real trail.
- **B. Real trails first** (Doudy Draw up/down/both with terrain edges and crash time costs, then the screens round
  it). Best riding first, but nothing to earn or spend for a while, and spending is what's missing.
- **C. Garage and shop first**, with cogs from today's challenges. Hooks the bike-loving oldest fastest, but without the
  map and places there is little to spend on.

## Goals of this slice

1. Opening the game shows the Colorado map: the garage (Lafayette), the shop, and one area you can ride. Your cogs and
   rider are always in view.
2. The area lists its challenges in three groups (Trail, Downhill, Park), each with its stars and what it pays. Tapping
   one drops you in to ride it, as today.
3. Both riders start fresh on the starter bike with 0 cogs. One trail, one downhill and one park challenge are open at
   the start; the starter bike can clear all three at 1 star.
4. Clearing pays cogs: most for a new star tier, a little for a repeat. 2 and 3 stars need upgrades (or a better bike)
   on purpose.
5. The garage shows your bike on a stand you can spin, with tap-a-part upgrades, a Specs tab, a Paint tab (free basic
   colors) and the bikes you own. Parts you own for that bike hang on its wall and swap freely.
6. The shop sells the three bikes (Dirt Jumper, Bolinas, Enduro) and parts for each bike you own, shown on the same
   stand with the same spec sheet.

## Non-goals (this slice)

- No real places yet (no Marshall Mesa, Valmont, Trestle, Vail); no lift tickets; no found or earned maps. The map
  shows only places you can go (see "My calls").
- No gear, no gear requirements, no crash time costs beyond today's (getting up, winded).
- No paint finishes to earn; basic colors only.
- No real bikes from spec sheets.
- No separate worlds per area: the one made-up area is today's whole park.
- No terrain-edge rework.

## Anti-goals

- **The ladder must not be skippable by skill alone.** If a skilled kid can 3-star on the bare starter bike, the
  upgrades mean nothing. 2-star and 3-star targets sit where the robots on the bare bike can't reach and the robots on
  an upgraded bike can. Where possible a target sits past a hard limit of the weaker bike (its top gear speed, its
  wobble speed, its spin), not just past the robots' best run, since a skilled 10-year-old can beat a robot.
- **The right bike must not be enough on its own.** 3★ is set near the best robot run on the matching bike with its
  upgrades (a clean line, smart braking and pumping, tricks landed), so the matching bike ridden carelessly, or bare,
  doesn't reach it.
- **Grinding one challenge must not be the fastest way up.** Repeats pay little; new stars pay most.
- **No paywall feel at 8.** Every open challenge is finishable at 1 star on the bike you have. Locks always say what
  opens them.
- **Stats must not lie.** The bars come from the same numbers the bike rides by.

## The pieces

### Map (home)

- Full-screen map image (`public/map/colorado.png` when the user has generated it; a plain drawn placeholder until
  then). The map image is background only: places are buttons the game draws on top, at positions stored per place,
  so adding a place never needs new art.
- On it: **Garage** (Lafayette), **Shop**, and the made-up area. Rider name and bike, and cogs, in a top bar. Switch
  rider stays reachable (today it sits at the bottom of Spots).
- Places carry a difficulty symbol (● green, ■ blue, ◆ black), borrowed from the trail-map mockup.

### The area

- One area for this slice, made up (my call: **"Shredder Hills"**), holding today's park. Its trails and features get
  names (approved; the boys may rename them):

  | Today's piece | Name | Runs |
  |---|---|---|
  | The climb and descent | **Goat Ladder** | up, down, both |
  | Switchbacks | **Hairpin Hollow** | up, down, both |
  | Rock chute | **Boulder Dash** | down only |
  | Rhythm line | **Whoop-de-Doo** | park |
  | Jumps S / M / L / XL | **Table Row**: Small, Medium, Big, XL | park |
  | Pump track | **The Pump House** | park |
  | Slalom | **Cone Zone** | park |
  | Skinny | **The Plank** | park |

  A run is named for its trail and direction: "Goat Ladder ↑", "Goat Ladder ↓", "Goat Ladder ↕" (both). The street
  stays as the area's start, unnamed.
- Tapping the area opens its challenge list, grouped **Trail** (time trials), **Downhill** (time + style), **Park**
  (tricks), each row showing its stars and what the next star pays, or what opens it if locked. A lock can ask for
  stars in the area, a part tier on the bike you're riding, or a bike type ("Needs more pop: try the Dirt Jumper"). Whatever a lock asks for, meeting it makes 1★ reachable. Go drops you at the
  challenge (today's teleport and ring card). "Just ride" (today's warps) stays.
- New runs on Goat Ladder (today's climb and descent) and Hairpin Hollow (today's Switchbacks, now also ridden down):
  **Up** (bottom to top, a timed `run`, in the Trail group), **Down** (top to bottom, timed, with the trick speed
  boost, in the Downhill group), **Both** (up and back down as one run). These use the `run` goal and start/finish
  lines that Rock chute and Switchbacks already use.
- **Open at the start (my call):** Goat Ladder ↑ (trail), Goat Ladder ↓ (downhill), and Table Row Small (park).
  Everything else in the area opens as you earn stars in it (a total-stars need, which `Need` already supports), or
  asks for a part or a bike where the challenge tests what the starter lacks (Boulder Dash, Whoop-de-Doo, Table Row
  XL). A trail's ↕ run opens once you've cleared its ↑ and ↓.

### Downhill speed boost

On Downhill challenges, landing a trick clean gives a short burst of speed (a few tenths of a second of extra push,
bigger for bigger tricks). It's the style part of "time + style". It can carry you past your bike's wobble speed,
which is the risk that makes it interesting. Size and length are tuned with the downhill robots. Off downhill
challenges, landing tricks does what it does today.

### Cogs and tiers

- Stars (1 to 3) stay as the tiers, scored as today (`byTime`, `byPoints`).
- A new star pays its tier's cogs once; tier pay rises steeply (3★ pays several times 1★). A repeat that earns no new
  star pays a small amount (my call: about a fifth of that challenge's 1★ pay), so riding is never worthless but
  grinding is slow. Banked trick combos no longer pay cogs on their own (that was the old bolt leak).
- **Pacing targets** (numbers are the builder's, tuned over time with the user):
  - first upgrade after about three first clears;
  - the first 2-star needs at least one upgrade;
  - the first new bike takes most of the area's 2-star clears, roughly a few play sessions, not one evening.
- The save's `bolts` becomes `cogs`.

### The starter bike

My call: the **Hand-me-down Hardtail**, a cheap, heavy hardtail that does a bit of everything, badly: weak legs and
high energy cost, a low wobble speed with a big kick, no plow, little pop, slow spin. It can clear 1★ on the three
starting challenges and nothing better bare. Its parts are what open its 2★ runs. It is a fourth entry in `LAB_BIKES`
/ `BIKE_RIDE`, a plain frame with a dull color, built like the others (no bike-id logic).

### Parts

- **Five slots per bike**, fixed now: **Suspension** (fork, and shock on the enduro), **Tires**, **Brakes**,
  **Cockpit** (bars, stem), **Drivetrain** (gears, cranks).
- **Start with few parts:** the hardtail gets the handful of upgrades its 2★ runs need; each other bike gets a few.
  More parts are added later as data; each addition re-runs the robots to re-check the star targets.
- Each bike has its own parts for each slot (stock plus upgrades). A part belongs to that bike only.
- **Brakes** move braking strength (`brake`); the strongest are grabby and skid sooner (`skidDecel`, or a new
  setting if that doesn't give the feel: builder's call). Better brakes let you brake later and shorter on a descent.
- **Tires** come in compounds: **sticky** (more `grip`, `bermGrip`, gravel traction via `looseLimit`/`looseDrag`, more
  `rolling` resistance) vs **fast-rolling** (less `rolling`, less grip). Each is a home-turf choice: sticky for Boulder
  Dash and Hairpin Hollow, fast for the climbs.
- A part moves that bike's ride settings (`BIKE_RIDE` keys: `wobbleKick`, `wobbleSpeed`, `plowSize`, `popSoak`,
  `gearTop`, `legs`, `energyCost`, `spin`, grip, pop...). Most sharpen the bike's strength; a few are home-turf
  trade-offs, as the bike-rules doc's piece 3 lists (dirt jumper big vs small gear, enduro coil vs air shock, Bolinas
  long vs short fork). Bump kick and wobble speed come from parts as already decided.
- Each part also carries its display specs (e.g. "Fork 140 mm", "Tires 2.4 in sticky", "4-piston brakes", "Bars 780
  mm", "1 × 12") and a price.
- **Geometry belongs to the frame.** Each bike lists its head angle, wheelbase and reach on the spec sheet, and its
  base numbers follow from them: slack and long rides stable (higher `wobbleSpeed`), turns wider (`minRadius`),
  steers slower (`steerResponse`) and flicks less (`spin`); steep and short the other way. A few parts nudge the
  geometry and the numbers with it (a longer fork slackens the head angle a degree; an angle-set headset).
- The save keeps unknown parts and slots harmlessly, so parts can be added and renamed later without breaking saves.
- Owned parts hang on that bike's wall in the garage and swap on and off for free.
- The old `parts.ts` (frame/fork/tires/pedals; Rusty/Solid/Shred, shared by all bikes) is replaced.

### Stats (eight bars, in three groups)

Brakes and tires need bars of their own, or their part cards would show no change, so there are eight, grouped by the
kind of challenge they help (my call):

- **Trail:** **Climb** (legs, energy cost, gear bog), **Speed** (top speed, gearing, rolling resistance)
- **Downhill:** **Grip** (grip, berm grip, gravel traction), **Stop** (braking), **Stable** (wobble speed and kick,
  steering), **Plow** (plow size, soak)
- **Park:** **Pop** (hop, lip pop, soak), **Flick** (spin)

Words from real reviews where they exist ("stable", "plows", "poppy", "flickable"). Each bar is a fixed formula of the
bike's current ride settings with its parts on; the same formula drives the green/red preview on a part card, so the
bars can't drift from how the bike rides. The grouping also tells a kid at a glance which challenges a bike is for.

### Garage

As in the chosen mockup:
- The bike on a stand, drag to spin 360°, using the same rider rig model the game rides, **with the rider on it**
  (decided after the plan: "that will allow us to show off the rider's gear"), astride it with a foot down; a button
  hides the rider to see the whole frame.
- Glowing dots on each slot. Tap one: a card with the part on now, the parts on your wall for this bike, and the shop's
  next one (with its price and a shortcut to buy), each showing only the stats it moves. "Put it on" swaps it.
- Tabs: **Parts**, **Paint**, **Specs**. Paint: a row of basic frame colors, free. Specs: the full spec sheet (bike
  name and type, geometry, each slot's part and its numbers, weight) plus the eight bars.
- Your bikes: switch between the bikes you own on the stand; "Ride this one" sets the bike you ride.
- The spin view is the place to admire the bike, so it gets the best lighting and the closest camera in the game.

### Shop

- The same stand and spec sheet, for things you don't own: the three bikes, and parts for each bike you own.
- Each item shows its price in cogs; buying a bike puts it in your garage with its stock parts; buying a part puts it
  on that bike's wall.
- Prices: the builder's, meeting the pacing targets above. Bikes cost far more than parts.

### Save

- Version 2 save: per rider: name, cogs, bikes owned (with each bike's owned parts, fitted parts and color), the bike
  being ridden, stars per challenge, how many times each challenge has paid (for repeat pay).
- **Both riders start fresh** on the starter bike with 0 cogs (they can no longer ride all three bikes from the start;
  that is what the loop needs). The old save's bolts, parts, stars and lessons are dropped.
- `?bike=` stays as a test shortcut that rides any bike without saving it, as today.

### What changes in today's page

- The page opens on the map instead of straight into riding. The Spots menu becomes the area's challenge list.
- Swap cycles only the bikes you own.
- **Tune is removed from the page**, with its warps (Just ride stays in the area list). The Tune code stays for the
  later experiment area. Saved Tune values stop applying: every bike rides by its own numbers plus its parts. A
  development-only URL flag may keep Tune reachable for the builder and the browser checks (builder's call); the boys
  never see it.
- Old challenge `need`s on the old parts (Big table, Hill line, lessons) are rewritten as area star needs.

## My calls (please check)

1. The made-up area is called **Shredder Hills**.
2. The starter is the **Hand-me-down Hardtail**, a fourth bike.
3. Stats: eight bars in three groups: Trail (**Climb, Speed**), Downhill (**Grip, Stop, Stable, Plow**), Park
   (**Pop, Flick**).
4. Open at the start: **Goat Ladder ↑, Goat Ladder ↓, Table Row Small.** The rest opens by stars, a part or a bike;
   a trail's ↕ opens after its ↑ and ↓. Hairpin Hollow is also ridden down.
5. Repeats pay about a fifth of 1★; banked trick combos stop paying cogs by themselves.
6. The map shows only places you can go. Real places appear when they're built, not as "coming soon" teasers.
7. Basic paint colors are in this slice and free.
8. Both riders start over.
9. Brakes' grabby side uses the existing skid setting unless it doesn't feel right.
10. A lock can ask for stars, a part, or a bike (after the builder check): "the bike you have" means the bike you're
    riding.

## Left to the builder

- Exact cog payouts, part and bike prices, and each part's numbers, against the pacing targets and the anti-goals,
  checked with robot riders: per challenge, the bare starter (1★ reachable), the upgraded starter (2★ reachable, 3★
  not), the matching bike bare and careless (3★ not), and the matching bike upgraded, ridden well (3★ just
  reachable).
- The speed boost's size and length.
- The look of the area list and the shop (following the garage mockup's style: cream panels, yellow buttons, chunky).
- The placeholder map drawing until the generated image exists, and the place positions on it.

## Later projects (in rough order)

1. Marshall Mesa for real: Doudy Draw and Springbrook, each up, down and both, plus cross-trail combinations (which
   unlock as you ride their halves); terrain edges (tall grass, trees, a cliff); each area its own world, loaded when
   picked.
2. Crash time costs and gear: getting up and being winded cost time, seeing stars; armor shortens them; gear in the
   shop and on the garage Gear tab.
3. Paint finishes to earn (chrome, glitter, stickers).
4. Valmont (bike park), then Trestle and Vail with lift tickets and gear requirements.
5. Maps found by riding (off the line, over a certain jump) and earned from challenges.
6. Real bikes from spec sheets: one of the bike types, its numbers nudged by the real specs.
7. More Nano Banana map iterations as areas are added.

## How we'll know

- The oldest plays longer, and asks about what he's saving for.
- The robots show each 2★ and 3★ target out of reach on the bare bike and in reach with the intended upgrades.
- A fresh rider can afford a first upgrade within the first session, and not a new bike.

## Nano Banana prompt (first map)

> A whimsical illustrated map of Colorado's Front Range, seen from above at a slight angle, like a board game or a toy
> diorama. Chunky, rounded, low-poly shapes with soft matte colors and warm late-afternoon sun with soft shadows. North
> is up. On the left (west), snowy mountain peaks along the Continental Divide, with pine forests and a winding highway
> (I-70) climbing west toward ski-town valleys. In the middle, the foothills and the tilted red-rock slabs of the
> Flatirons above a small city. On the right (east), rolling golden-green plains with a small town, a lake, farm
> fields and cottonwood trees, and gentle mesas with dirt trails between the plains and the foothills. Sky blue at the
> top edge. Colors: sage green #8fae5a, forest green #3f6b3a, warm sand #ddd1b2, stone #b5a891, lake blue #8fb0de,
> cream #f2f0eb, red-brown rock #4a3a35. Leave open, uncluttered ground in the plains, the mesas, the foothills and the
> mountains, so buttons can be placed on top. No text, no labels, no letters, no road signs, no people. Landscape,
> 4:3, high resolution.
