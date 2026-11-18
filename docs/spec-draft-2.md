Shoshone Shredder: Game Spec (Draft 2)
Oct 30, 2026 · @Philippe Moore
Summary
Shoshone Shredder is a 3D bike game for iPad, set in a toy-like copy of the boys' real neighborhood, Indian Peaks in Lafayette. Every roof, fence, trampoline and golf-course hill is something to ride. Riders find collectables, earn parts and build better bikes in the family garage, and each new part opens more of the map.
• Players: two brothers, ages 8 and 10. Made for a 10-year-old, easy enough for an 8-year-old. Each rides as himself and picks his own hair color and style.
• Platform: three.js in Safari on iPad (the oldest is a 10th generation), added to the home screen and served from the home network.
• Feel: arcade, forgiving and funny. Big air, soft landings, silly crashes.
• Promise: something new, funny or surprising in every minute of play.
Design pillars
Six rules every feature must serve. If an idea breaks one, cut it or change it.
1. The whole neighborhood is a bike park. If a kid can see it, they can ride it, jump it or grind it.
2. Landing is easy, style is hard. Landings forgive mistakes. Combos and clean style earn the big points.
3. Crashes are funny; big ones sting. A normal wipeout costs a few seconds. A big crash costs more, and the right gear softens it.
4. A surprise every minute. Something new, silly or hidden turns up in every minute of riding.
5. Every bike is different, every upgrade is earned. Each bike type is great at something and bad at something. Upgrades come slowly enough to feel big.
6. It feels like home. Real streets, the family's house, the boys as riders, and the neighborhood's golden retrievers.
Big decisions
Decided so far: an open neighborhood to explore, thumb-and-swipe controls, a toy-style world from real map data, arcade physics, iPads on the home network, four part tiers and the toy look.
Decision
Options
Pick
Why
Game shape
Open neighborhood with short challenges; level-by-level runs; endless downhill runner
Open neighborhood
Exploring their own streets is the whole point. Challenges add short goals. A runner drops exploring and building.
Controls
Thumb steer, auto-pedal, tap and swipe for tricks; tilt to steer; two virtual sticks
Thumb, tap and swipe
Tilt is imprecise and tiring. Two sticks are hard at 8.
World
Map data plus toy-style houses and hand-placed features; fully hand-built; photo-real 3D map tiles
Map data plus toy style
Real street layout for free. Photo-real tiles are heavy, need a map service key, can't work offline and are lumpy to ride.
Physics
Arcade bike on top of a physics engine; full bike simulation
Arcade
Simulated bikes tip over and frustrate kids. Arcade lets us tune how forgiving it feels.
Art style
Toy diorama; crisp low-poly; cartoon outlines
Toy diorama, chosen after the look test
See Look and feel.
Device
iPad; phone
iPad, tuned for the 10th generation
It is what the boys use, and the oldest sets the speed budget.
Hosting
Home network; private web link
Home network
Keeps the real map and the boys' names at home.
Voices
Recorded voices; none
None
Speech bubbles, music and sound effects only.
Upgrades
Levels 1 to 3; four tiers
Rusty, Solid, Shred, Legendary
Fewer, bigger steps. Legendary parts glow and add a perk.
Look and feel
The target is a toy model of the real neighborhood on a sunny Colorado afternoon: warm, bright and easy to read at a glance. The family's photos of the house, the street and the park set the details and colors below.
Option
Looks like
Good
Watch out
Toy diorama (chosen)
Chunky rounded shapes, soft matte colors, warm low sun, soft shadows
Charming, makes the family's house feel special, hides low detail
Shadows must be baked ahead of time to stay fast
Crisp low-poly
Flat-shaded facets, bold colors, clean sky
Fastest to draw and to build
Can look generic
Cartoon outlines
Black outlines and flat color bands, like a comic
Very readable, great for trick pop-ups
Outlines cost speed on iPad and get busy on detailed houses
From the photos
• Home Base: a two-story Craftsman house in dark brown shingle siding with white trim, stacked front gables with white braces, a charcoal roof, a teal front door, white columns on stone bases and a dark brown two-car garage door. Out front: a wide concrete driveway, a curved stone planter, gravel beds, round shrubs and a gray split-rail fence.
• The Street: a gentle curve under big leafy trees, with wide sidewalks, tan and cream stucco neighbors with stone trim, and split-rail fences.
• The Park: a white picket fence, concrete steps with black handrails, a green play tower with a wide cream slide, a green swing set, white boulders and an open lawn under tall trees.
Palette. Colors come from the photos, nudged brighter for the toy look.
Element
Game color
Siding, dark brown
#4a3a35
Trim and picket fence, white
#f2f0eb
Roof, charcoal
#6e7274
Front door, teal
#7fb3b2
Stone, tan
#b5a891
Driveway and steps, concrete
#cfcbc2
Split-rail fence, weathered gray
#8a8174
Play tower and swings, green
#3f6b3a
Slide, cream
#ddd1b2
Lawn
#8fae5a
Aspen leaves
#8fa850
Pine needles
#2f3d2e
Sky
#8fb0de
Look test. The look test shows the house, the street and the park next door in all three looks, with a rider to follow. Flip between them on the oldest iPad. Here is the toy look:
 
Feel
• Camera: a chase camera that pulls back on big air so the landing is always in view.
• Speed: wind noise rises, the view widens a little and dust kicks up as the bike goes faster.
• Landings: the bike squashes and springs back with a puff of dirt, grass or snow.
• Ground sounds: tires buzz on pavement, crunch on dirt and swish through grass.
• Readability: riders, rideable edges and collectables always stand out from the background.
• Phase 0 tests all of this on the oldest iPad with one street in the chosen look.
Core loop
Riding earns parts, parts open places, and new places give more to ride. A typical session: leave the garage, free ride through a few surprises, and try a challenge or two. Then the dinner bell calls the rider home to build.
Riding, controls and tricks
Riding must feel good in the first ten seconds, before any menu.
Touch controls (iPad, landscape)
• Left thumb: touch anywhere on the left half and drag to steer. Push up to pedal harder, pull down to brake.
• Right thumb: tap to hop. Hold to crouch, release to pop higher, best right at a ramp lip. Swipe in the air for tricks.
• Auto-pedal and auto-land are on by default. Each rider can turn them off as skills grow.
• Again button: after a crash, one tap puts you back at the last takeoff.
• Controls sit in the lower corners, where thumbs rest on an iPad, and the middle of the screen stays clear. A keyboard or game controller also works, for testing.
Tricks. Use real trick names, the same ones used at bike club. Start with four: bunny hop, manual, tabletop and no-hander. The rest unlock one at a time, in table order.
Family
Tricks
How
Ground
bunny hop, manual, nose manual, track stand, endo
tap; swipe up or down while rolling
Air
tabletop, no-hander, no-footer, superman, can-can, X-up, 360, barspin, tailwhip, backflip, frontflip
swipe in the air; swipe twice for a double (double whips need a BMX)
Rails and walls
fence grind, gutter grind, curb slide, wall ride, wall tap
land on an edge with pegs or a BMX; hop toward a wall
Big moves
roof drop, roof gap, trampoline triple, playground-slide drop-in
found around the map
Silly
The Flamingo, Pizza Delivery, The Selfie (mid-air photo), Goose Honk
unlocked by surprises and neighbors
Scoring and combos
• Chain tricks before landing, and link landings with a manual or grind, to grow a combo multiplier.
• A Stoke meter fills with every trick. When full, the rider is Stoked for 10 seconds: double points, louder music, everything bouncier.
• Normal crashes cost only the combo in progress and a few seconds. Big crashes cost more (see Crashes and gear).
• Trick Maker: string 2 to 4 moves together and name it. It joins the trick list with the inventor's name on it.
• New tricks unlock from challenges and from Grandpa Gears, the retired pro down the street.
Crashes and gear
Normal crashes are cheap. Big crashes cost something real, and the right gear shrinks that cost. A big crash is a fall from roof height or more, a bad landing off a big jump, or hitting a wall at full speed.
Crash
What it costs
Bobble
A wobble and a little speed. Keep riding.
Wipeout
The combo in progress. Up in about 2 seconds, or tap Again.
Big crash
The combo, plus the big-crash penalties below
Big-crash penalties to choose from
Penalty
What happens
What softens it
Use it?
Yard Sale
Bolts picked up since your last bank scatter; grab them back within 5 seconds
Knee pads get you up faster; a helmet and chest pad help too
Yes
Seeing stars
Steering wobbles and the view blurs for up to 6 seconds
Helmet; a full-face nearly stops it
Yes
Winded
Weak pedaling for a few seconds, and the Stoke meter empties
Chest pad
Yes
Bent part
One part rides a tier lower until a quick fix at the garage workbench
Suspension; the downhill bike barely bends
Yes, biggest crashes only
Mud in the eyes
Dirt or snow splatters the view
Goggles
Yes, on dirt and snow
Magpie raid
A magpie grabs a sticker you were carrying while you're dazed
Pika Pedals
Maybe, as a rare surprise
Long walk back
Restart at the bottom of the line, not at the takeoff
Nothing
No: it kills retries
Sent home
Three big crashes end the ride
Nothing
No: too harsh at 8
Decided: Yard Sale, Seeing stars and Winded. They work together: stars and lost breath slow you down, so better gear means more Bolts come back. Add Bent part and Mud in the eyes if big crashes still feel free in playtests. Bolts are safe once banked: ride home, or drop them in a Bolt Jar at the park or the lake.
Gear
Each piece of gear has one job, gets better with each tier, and has a Legendary version. Goggles matter most on real windy, rainy or snowy days, since the game uses Lafayette's live weather.
Gear
What it does
Legendary version
Helmet
Shortens Seeing stars; a full-face nearly stops it
Bighorn Full-Face: bonk a wall and bounce off instead of crashing
Goggles
Keep the view clear of dust, mud, rain, snow and low sun
Hawk Goggles: hidden stickers glint from twice as far
Chest pad
Shortens Winded and keeps half the Stoke meter
Elk Pad: barrel through hedges with a bugle instead of crashing
Gloves
Grinds and wall rides last longer before you slip
Bear Paw Gloves: grinds last twice as long
Knee pads
Get up faster from any crash, so more Bolts come back in a Yard Sale
Marmot Pads: pop up with a whistle and a speed boost
Shoes
Feet stay on the pedals: a wider landing window and safer no-footers
Mountain Goat Shoes: grip steep rock and snow
The neighborhood
The map starts at the family's driveway and grows outward to the park, the golf course, the ditch trail and the open space. Real places keep their real layout; houses and yards get a toy-style makeover.
The home map is about 1.25 miles corner to corner. Waneka Lake and Valmont Bike Park are separate maps, reached by the family car. Busy roads such as Baseline Road are soft walls: a crossing guard waves riders back and walks them across at the crosswalk. The game never rewards riding in traffic.
Zone
Real place
What to ride
Opens when
Home Base
The family's house and garage on Shoshone Trail
Driveway kicker, garage-door wall ride, backyard
Start
The Street
Shoshone Trail and nearby cul-de-sacs
Curbs, driveways, trash-day bins, basketball hoops, mailbox clusters
Start
The Park
Indian Peaks Trail West Park, right next door and the boys' favorite, plus food-truck nights
The wide slide, the entry steps and handrails, picket-fence grinds, boulder hops, swings and the open lawn. The slide hides the portal.
Start
Backyard Run
Fence lines behind the houses
Fence-top grinds, trampolines, swing sets, sheds, kiddie pools
Pegs or a BMX
Rooftop Highway
The roofs along the street
Roof gaps, gutter grinds, chimney taps, solar panels as speed strips
Bounce up from a backyard trampoline
The Course
Indian Peaks Golf Course, the neighborhood's golf course
Rolling fairways, sand traps, ponds, cart paths, flagsticks
At dusk, when it closes and the sprinklers come on; fat bike for sand
Ditch Trail
The ditch trail that links to the Coal Creek Trail
Ditch jumps, a culvert pipe to ride through, berms
Solid drivetrain
Prairie Dog Flats
The open space south of Baseline Road; the Callahan Open Space trailhead is about 0.4 miles from home
Singletrack, prairie dog mounds as rollers, tall grass
Enough Trail Karma that the crossing guard walks you across
Waneka Lake
Waneka Lake Park: 147 acres, a 1.2-mile trail around the lake, and paddle boat rentals in summer
Lake loop, fishing docks to launch from, the playground, paddle boats to hop (flamingo-shaped in the game)
Family car
Valmont Bike Park
Valmont Bike Park in Boulder: 42 free acres with dirt jump lines from XS to XL, slopestyle lines and pump tracks
The real lines, each with an easy way around, as at the real park
Family car. Every line is open, but L and XL need the right bike and punish big crashes without gear
The Old Mine (secret, made up)
Lafayette's coal mines, which dug a maze of tunnels under town
Mine-cart rails, glowing gems, bats
Every mine-map piece, plus lights
The Portal (secret)
The bottom of the park slide
Slide down at full speed holding a postcard to pop out in the mountains
A postcard for each destination
Portal destinations (each opens with its postcard)
• Alpine Lake: a high lake like the Indian Peaks lakes some street names echo, with snowfields, boulders and pikas.
• Red Rock Canyon: tall red sandstone fins and smooth rock for wall rides.
• Sand Dunes: giant dunes to surf down. Fat bike only.
• Aspen Gold: a fall forest of golden aspens with flowy singletrack and bugling elk.
• Snowy Summit: a 14,000-foot ridge with mountain goats and a long snowy descent. Downhill bike only.
Everyday stuff that becomes a ride
• Garage doors are wall rides. An open one lets you ride straight through the garage and out the back.
• Trampolines bounce higher with each landing. Three in a row is a trampoline triple.
• Basketball hoops: tap the rim mid-air for a Slam Dunk bonus.
• Trash day: rows of bins to hop. Knock one over and a raccoon pops out and chases you.
• The neighbor's parked RV is the biggest launch ramp on the street.
• Leaf piles and snowbanks are soft landings that burst on impact.
• Sprinklers: ride through for a rainbow and a speed boost.
• Holiday inflatables are bounce pads. A giant Halloween skeleton is a ramp.
The skyline shows the real Front Range: the Flatirons, the Indian Peaks and Longs Peak. Many street names echo places in the Indian Peaks Wilderness, such as Blue Lake and Cascade Creek. From the highest roof, binoculars let riders tag each peak for a Peak Finder sticker.
Collectables
Every street, roof and yard hides something, and every find does something: buys a part, decorates the bike or opens a place. The map shows a count per zone, such as 7 of 12 stickers, so kids know what is left.
Collectable
Where
What it does
Bolts
Everywhere, in lines that trace good jumps
Buy Solid parts and paint. New tricks and spots pay most; repeats pay less
Stickers, about 60 in themed sets
One hidden at every cool spot
Decorate bike, helmet and gear; a full set unlocks a paint job
Roof Stuff: tennis balls, frisbees, footballs, kites, a drone, a rubber chicken
Stuck on roofs and in trees
Return each to its owner, often a golden retriever, for Bolts or an add-on
Golden retriever friends (12)
Yards, the park and Waneka Lake
Return a golden's lost toy and it runs alongside for a ride; all 12 earn the Goldie Bell
Shy prairie dogs (20)
Open space and yards
Sneak up slowly to photo them; a full Prairie Dog Census unlocks a prairie dog sidekick
Lost golf balls
Rough, sand traps and ponds
Trade 10 at the pro shop for a Shred Kit
Postcards (5)
The hardest spots around the map
Each opens a portal destination
Stegosaurus bones (8), Colorado's state fossil
Buried in sandboxes, sand traps and prairie dog mounds
The finished skeleton becomes a giant ramp in the park
Mine-map pieces (5)
Behind the hardest jumps
Open the Old Mine
Gems: rhodochrosite and aquamarine, the state mineral and state gem
The Old Mine
Rare sparkle paints
Bells
Rewards from neighbors
Silly sounds: goose honk, cowbell, squeaky toy, slide whistle
Blueprints
Challenge rewards
New bike types (see Bike garage)
Crash cards
A new kind of crash
Fill the Wipeout Album: Bush Dive, Trash-Can Dunk, Pool Plunge, Goose Bonk
Trail Karma
Ring before passing walkers, slow for little kids, return lost stuff
Unlocks the Rainbow Bell and secret shortcuts through friendly yards
Bike garage
The family garage is home base. Bikes and gear get better slowly, each bike type stays different, and Legendary finds stay rare.
Part tiers
Every part and every piece of gear comes in four tiers: Rusty, Solid, Shred and Legendary. Rusty squeaks and shows orange spots; Legendary glows and adds a perk.
Tier
How you get it
First one around
Rusty
Starter parts and garage sales
Session 1
Solid
Bolts
Session 1 or 2
Shred
Bolts plus a Shred Kit, won in challenges or traded for golf balls
Sessions 4 to 6
Legendary
Found or won once, never sold
Sessions 8 to 12
Keeping upgrades slow
• Parts belong to one bike. Upgrading the BMX does nothing for the downhill bike.
• Variety pays. The same trick in the same spot pays fewer Bolts each time, and the count resets each day.
• A fully Legendary bike should take a few weeks of regular play. All prices live in one tuning file, adjusted after playtests.
Slots. Each bike has four tiered slots: Wheels, Suspension, Drivetrain and Cockpit (bars, grips and brakes). Add-ons are found once and fit any bike: pegs, lights, a bell and a basket. Paint and stickers change looks only. Parts move five stats in kid words: Speed, Pop (jump height), Grip, Squish (soft landings) and Spin (trick speed).
Legendary parts
Part
Slot
Perk
Chinook Wheels
Wheels
A tailwind on every jump
Hailstone Tires
Wheels
Extra bounce off trampolines and roofs
Aspen Leaf Fork
Suspension
Drift down slowly after big air
Pika Pedals
Drivetrain
A squeak that scares off magpies
Hummingbird Bars
Cockpit
Barspins and tailwhips spin twice as fast, with a hum
Thunderclap Brakes
Cockpit
Stop on the spot with a thunderclap that scatters geese
Goldie Bell
Add-on
A golden retriever fetches the nearest hidden sticker
Bikes that feel different. Each type has limits no part can break: a Legendary BMX still can't take a roof drop like a downhill bike. Some places need a certain bike, so the garage wall fills up.
Bike
Great at
Bad at
Only this bike can
Trail bikes (the starters)
Going anywhere
Nothing stands out
Ride every zone at an OK level
BMX
Spins and grinds
Rough ground, big drops
Grind without pegs and pull double tailwhips
Dirt jumper
Pop: the highest jumps
Singletrack, big drops
Clear the longest roof gaps and Valmont's XL dirt jump line
Downhill bike
Squish: huge drops, fast descents
Climbing, spinning
Survive the tallest roof drops and ride the Snowy Summit
Fat bike
Sand, snow and mud
Speed, tricks
Ride sand traps, snow days and the Sand Dunes
Cargo bike
Carrying a golden retriever
Everything else
Make deliveries with a dog that fetches
The two starters differ the way the real bikes do. The Bayview Trail's 24-inch wheels turn and spin quicker; the Bolinas Ridge's 27.5- or 29-inch wheels roll faster over rough ground.
Rider look. Each boy rides as himself and picks hair color and style. Hair sticks out under the helmet, so a wild color always shows. Gear comes in colors and takes stickers.
Garage Sale Saturday: on real Saturdays, random garages open with Rusty and Solid parts, joke parts (square wheels, a pogo-stick fork, an umbrella for slow falls) and now and then a Shred Kit.
Family touches
• The boys' real bikes, a tan Marin Bolinas Ridge and a black Marin Bayview Trail, are the starter trail bikes.
• Dad's Rift Zone hangs on the wall. Kids can ride it any time, but it is too big: feet can't reach the pedals and the ride is a wobbly mess. A full sticker book shrinks it to fit.
• The family car with a bike rack is fast travel: to any zone already opened, Waneka Lake and Valmont Bike Park.
Surprise and delight
A Delight Director makes sure something new, silly or hidden happens every 45 to 90 seconds of riding, without the boys ever spotting a pattern.
The Delight Director
• Tracks time since the last surprise, where the rider is and what they have already seen.
• Draws the next surprise from a weighted deck. Rare ones stay rare, and nothing repeats in a session.
• Long quiet stretches get a big surprise; busy moments get a small one or none.
Small surprises
• Geese cross the street. Ring the bell to part them, or they chase you, honking.
• A magpie swipes your newest sticker. Chase it across three roofs to get it back.
• A wind gust lifts a jump into mega air, and a tumbleweed rolls down the street.
• A loose birthday balloon floats past. Jump to pop it for a prize.
• The ice cream truck jingle starts. Catch the truck for a speed-boost popsicle.
• A golden retriever breaks loose, runs alongside you, then fetches a sticker.
• A golden prairie dog pops up for 10 seconds.
• Land a big combo and garage doors open one after another down the street, with neighbors cheering.
• The biggest air of each session plays back in slow motion with a swooping camera.
Daily Weird Thing (one per real day)
• A giant inflatable dinosaur on a roof. Ride up its tail.
• A hot air balloon lands in the park. Ride into the basket for a sky drop.
• A llama wanders through backyards. Follow it to a secret.
• At night a UFO beams up trash cans over the golf course. Follow it to unlock Moon Mode, with low gravity.
• A runaway giant pumpkin rolls down Shoshone Trail (October only).
• A backyard birthday party with a bounce house that works as a mega launcher.
• A golden retriever parade: a dozen goldens chase one tennis ball down Shoshone Trail.
The real world leaks in
• Weather: the game checks Lafayette's real weather. Snow outside means snow in the game. Hail sends riders under porches.
• Time of day: sunset behind the real peaks, then streetlights, bike lights and hooting owls.
• Seasons: Halloween trick-or-treat runs and costumes; snowmen as ramps in winter; baby geese in spring; sprinklers and pool days in summer.
• Local events: food-truck nights at the park. Peach Week around the real Lafayette Peach Festival in mid-August, when golden peaches appear for a Peach paint job.
Secrets: the slide portal and the Old Mine (see The neighborhood), the Stegosaurus ramp, and cheat codes typed on the garage-door keypad: big heads, Moon Mode, everyone is a prairie dog.
From real life
• Skills from bike club show up as challenges: cornering, braking and track stands.
• The best trick photos get pinned to the fridge in the game's kitchen: the Fridge Wall of Fame.
• Real Ride Rewards: after a real ride or club practice, a parent taps "We rode today" for a bonus crate.
• If the backyard climbing wall gets built, it shows up in the game as a wall ride.
Characters and critters
The neighbors are made up, so no real neighbor ends up in the game. The critters are the real Colorado ones the boys see on rides. Nobody speaks out loud: neighbors talk in speech bubbles.
Neighbors
• Grandpa Gears: a retired pro rider who teaches a new trick for each challenge you beat.
• Captain Cul-de-sac: the HOA inspector who writes tickets for Excessive Radness. Collect all 10.
• The Lemonade Twins: their drink fills the Stoke meter.
• Ms. Petunia: crash into her prize garden and she gives you a flower sticker anyway.
• The Dog Walker: six golden retrievers, six leashes, one moving obstacle course.
• Toddler Tornado: a tiny kid on a balance bike who is somehow always ahead of you.
Critters
• Canada geese block paths and chase riders who don't ring first.
• Prairie dogs pop up, chirp alarms and dive when a hawk circles.
• Magpies steal anything shiny.
• Deer bound alongside riders on the golf course at dusk.
• A great horned owl hoots hints at night.
• Cottontail rabbits dart across every lawn, and a raccoon lives in the trash bins.
• Golden retrievers are everywhere, as in the real neighborhood. They run alongside riders, play fetch and keep losing tennis balls on roofs.
A light story: The Great Magpie Heist. The neighborhood's Golden Bell vanishes a week before the end-of-summer Bike Fest. Each zone holds a clue, and each clue opens the next zone. The trail ends at a magpie's nest at the top of the tallest tree, stuffed with every shiny thing stolen during the game. Pika Pedals help in the final chase. The finale is the Bike Fest parade down Shoshone Trail.
Playing together
Two brothers should be able to compete and team up on one device or two, with no accounts and no strangers.
• Separate riders, shared garage. Each boy has his own profile, bikes and sticker book. The garage wall and the Fridge Wall of Fame are shared.
• Brother ghosts. Each boy's best run on a challenge is saved as a see-through rider. Race your brother's ghost any time, even while he is at school. Saves and ghosts sync through the home server, so each boy races on his own iPad.
• B.I.K.E. A trick battle like H-O-R-S-E, passing one device back and forth. Land a trick; if your brother can't copy it, he gets a letter.
• Tandem mode. Two kids, one iPad: one steers from the left side, the other does tricks from the right.
• Follow the Leader. One rides a line, the other copies it, and the game scores how close they stayed.
• Later, maybe: live play between two devices on the home network. No internet play.
Kid and parent rules
No ads, no purchases, no chat and no accounts. Everything is earned by riding.
• Easy to read: icons first, short words, big buttons. An 8-year-old can play without help.
• Assists per rider: auto-pedal, auto-land and slow-motion landings, each on or off.
• Short sessions: one full loop of ride, find and build fits in 10 to 15 minutes, and every session ends with something new in the garage.
• Dinner bell: a parent sets a play time. When it runs out, the dinner bell rings, a note calls the rider home, the game saves, and the day ends with a short recap.
• Cartoon crashes: no blood and no injuries shown. Riders always wear a helmet, though the helmet can be a dinosaur head.
• Loading tips mix real skills (look where you want to go, ring before passing) with jokes: "Roof drops only work in the game. Real roofs are made of ouch."
• Parent PIN guards settings and play time.
• Comfort: swap sides for left-handed players, resize buttons, and use colors that work for color-blind players.
• Privacy: the game lives on the home network, so the real street map, the house and the boys' names stay at home.
• Good habits pay: crossing at crosswalks, ringing before passing and wearing a full-face for big lines all earn rewards.
Tech outline
A TypeScript three.js app built with Vite and shipped as an installable, offline web app. The world is generated once from map data and baked into files the game streams in.
Stack
• three.js (WebGL 2), TypeScript, Vite.
• Rapier (WASM) for collisions, triggers and crash ragdolls. The bike itself is a custom arcade controller: raycast wheels, assisted balance, air control.
• Web Audio for music and effects. No voice audio.
• Added to the iPad home screen from Safari, so it opens full screen like an app. Safari has no vibration support, so feedback is sound and visuals.
• Hosting: a Raspberry Pi on the home network serves the game. Offline play needs a service worker, and service workers need HTTPS even at home. Give the Pi a certificate the iPads trust, such as one from Caddy's local certificate authority or a Tailscale HTTPS name.
• Safari can clear site storage, so saves also back up to the Pi.
World pipeline (run once, offline)
1. Export roads, paths, building footprints, parks, water and the golf course from OpenStreetMap, plus small separate exports for Waneka Lake and Valmont. Use Overture Maps if houses are missing.
2. A build script turns footprints into toy houses with simple roofs, puts fences between backyards and drops trees.
3. Hand-place the fun with an in-game editor that saves JSON: ramps, trampolines, collectables, secrets.
4. Bake into map chunks (glTF plus JSON) that stream in by distance.
5. Hand-model the family house, the garage, the park and its slide from photos. Portal destinations are hand-built.
Modules
Module
Job
Input
Turns touch, keyboard and controller into one set of actions
Bike
Arcade riding, tricks, combos, crashes
World
Loads chunks and tags rideable surfaces: roof, rail, wall, trampoline
Director
Picks surprises and the Daily Weird Thing
Garage
Parts, tiers, gear, bike types, painting
Progress
Collectables, unlocks and per-rider saves, backed up to the Pi
Real world
Date, time of day and weather from a free weather API such as Open-Meteo, cached
Audio
Music layers and effects
UI
HUD, menus, sticker book, parent screens
Rider
Each boy's rider: hair color and style, gear looks
Economy
Bolt payouts, the repeat fall-off and tier prices, in one tuning file
Targets
• 60 fps on the 10th-generation iPad, the oldest in the house. Newer iPads get sharper rendering, not more content.
• Under 150 draw calls per frame: instanced houses, fences and trees; one texture atlas; lighting baked into vertex colors; a live shadow only under the rider.
• Render resolution drops on its own when frames slow down.
• First load under 15 MB; later zones stream in.
Testing: a debug overlay (fps, draw calls), a seeded Director for repeatable runs, unit tests for scoring, unlocks and the Director, and a playtest with the boys at the end of every phase.
Build phases
Each gate is a playtest with the boys on their own device, and nothing moves on until it passes. Phase 0 is small on purpose: if riding one street isn't fun, more map won't fix it.
Open questions
[x] Devices: iPads; the oldest is a 10th generation.
[x] Riders: the boys as themselves, each picking hair color and style.
[x] Name: Shoshone Shredder.
[x] Hosting: the home network to start.
[x] Voices: none.
[x] Photos of the house, the street and the park.
[x] The park: Indian Peaks Trail West Park, next door.
[x] Starter bikes: a tan Marin Bolinas Ridge and a black Marin Bayview Trail.
[x] Upgrade pace: as planned.
[x] Gear: no hard gates. The helmet and chest pad soften big-crash penalties.
[x] Big-crash penalties: Yard Sale, Seeing stars and Winded.
[x] Look: toy model.
[x] Portal order: any.
[x] Phase 0 build plan: Shoshone Shredder: Phase 0 Build Plan.
