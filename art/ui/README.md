# UI art (first test set)

Pictures that give the cards, the area list and the riding HUD some character, in the same chunky clay-diorama style
as the map. This is a test set: the trail sign, the star and cog icons, and one postcard. Once these look right in the
mockups, the other postcards and badges follow the same recipe.

For every prompt, attach `public/map/colorado.png` as the **style reference**. Save each result at the path given,
as PNG, at the highest resolution Nano Banana offers. The magenta backgrounds get cut out afterwards (Claude does
that), so don't worry about them.

If something comes back wrong, give Nano Banana the picture back with one fix at a time: "Keep everything else
exactly the same, but ...".

## 1. The trail sign: `art/ui/sources/sign.png`

It stretches sideways to fit any course name, so the middle must be plain and even.

> Use the attached picture only as a style reference: match its chunky, rounded, low-poly clay look, soft matte
> colors and warm late-afternoon light. Don't copy anything in it.
>
> Make one blank wooden trail-marker sign, the kind nailed to a post at a mountain bike trailhead, seen straight on
> from the front with no perspective and no tilt. It is a single long horizontal plank of warm brown stained wood
> with gently rounded corners, a routed groove running around the edge just inside the border, and two dark round
> bolt heads near each end. Soft, subtle wood grain. The middle of the plank is plain and even, with no knots,
> marks or bolts, so it can be stretched sideways. The plank fills most of the picture's width, centered, with a
> little space around it. No post.
>
> Background: flat, solid, pure magenta (#FF00FF), with no shadow, glow or gradient on it, and no magenta or pink
> anywhere on the sign. No text, no letters, no symbols, no arrows. Landscape 21:9.

## 2. Stars and cog: `art/ui/sources/icons.png`

> Use the attached picture only as a style reference: match its chunky, rounded, low-poly clay look, soft matte
> colors and warm late-afternoon light. Don't copy anything in it.
>
> Three game icons in a single row, evenly spaced, each one centered in its own third of the picture, all the
> same size, seen straight on from the front:
> 1. A chunky, puffy five-pointed star with softly rounded points, in shiny warm gold, like a prize.
> 2. Exactly the same star shape in pale grey stone, matte and a little dull, like an empty slot still to be won.
> 3. A round brass coin shaped like a bicycle chainring cog: a ring of short rounded teeth around the edge and a
>    round hole in the middle.
>
> Each icon is simple and bold enough to read at the size of a fingertip. Background: flat, solid, pure magenta
> (#FF00FF), with no shadows, glow or gradient on it, and no magenta or pink in the icons. No text, no numbers, no
> letters. Landscape 16:9.

## 3. Postcard, Goat Ladder: `art/ui/sources/postcards/goat-ladder.png`

Attach **two** pictures: `public/map/colorado.png` (style) and `art/ui/sources/goat-ladder-aerial.png` (a
screenshot of the course from the game, used for the layout).

> The first picture is the style: match its chunky, rounded, low-poly clay diorama look, soft matte colors and warm
> late-afternoon light. The second picture is a screenshot from a video game: use it for the layout only and
> repaint it fully in the first picture's style.
>
> Show the trail on the right side of the screenshot: a straight, steep dirt climb up a grassy hill, lined on both
> sides with rows of rounded boulders, a few loose rocks on the trail, a log lying across the trail at the bottom,
> and a round flat stone platform at the top. To its left, keep the winding dirt switchback trail with its boulder
> edges. Replace the empty flat ground and plain sky: put pine forest and rolling green foothills behind the hill,
> snowy peaks far off, and a soft blue sky. On one big boulder near the top of the climb, a small white mountain
> goat stands looking down the trail.
>
> It should feel like a picture postcard of a mountain bike trail. No riders, no people, no bikes, no text, no
> signs. Landscape 3:2.

## 4. Up, down and both ways: `art/ui/sources/hills.png`

These go after a course name in place of ↑ ↓ ↕ (on the sign, the cards and the list), so they have to read at the
size of a word.

> Use the attached picture only as a style reference: match its chunky, rounded, low-poly clay look, soft matte
> colors and warm late-afternoon light. Don't copy anything in it.
>
> Three small game icons in a single row, evenly spaced, each one centered in its own third of the picture, all the
> same size, seen from the front and a little above. Each is the same simple, rounded, grassy clay hill, shaped like
> a soft dome, a bit wider than it is tall, with a light brown dirt trail on it and one thick, chunky, rounded clay
> arrow lying along the trail:
> 1. The trail climbs the left side of the hill from the bottom to the top. A green arrow follows it, pointing up to
>    the top.
> 2. The trail runs from the top down the right side to the bottom. An orange arrow follows it, pointing down to the
>    bottom.
> 3. The trail goes up the left side, over the top and down the right side. A blue arrow follows the whole trail,
>    pointing down at the bottom right.
>
> Keep them simple and bold: no trees, rocks, people or bikes, just the hill, the trail and the arrow, big enough to
> read at the size of a fingertip. Background: flat, solid, pure magenta (#FF00FF), with no shadows, glow or
> gradient on it, and no magenta or pink in the icons. No text, no numbers, no letters. Landscape 16:9.

### 4b. Second try: the arrow is the icon, the hill is behind it

The first try looked great but read as three green hills at word size: the arrows were too small to tell up from
down. Give Nano Banana the first result back with this:

> Keep exactly this style, these colors and this clay hill. Change three things in all three icons:
> 1. Make each hill lower and flatter, a gentle mound about half as tall as it is now.
> 2. Make each arrow much bigger and fatter, at least three times as thick, so the arrow is the first thing you see
>    and fills most of the icon. The arrowhead is big and blunt.
> 3. Make the directions bold and simple: the green arrow goes in a straight line from bottom left up to the top of
>    the hill. The orange arrow goes in a straight line from the top of the hill down to the bottom right. The blue
>    arrow makes one smooth upside-down U: up from the bottom left, over the top, and down to the bottom right, with
>    its arrowhead at the bottom right.
> Same flat solid magenta (#FF00FF) background, no text. Landscape 16:9.

## What happens next

Drop the files in `art/ui/sources/` and tell Claude. The magenta comes out with
`node art/ui/build.mjs key <source> art/ui/keyed/<name>.png` (one picture per file: crop a sheet of three first),
and `node art/ui/build.mjs` turns the keyed masters into the small WebP files the game loads from `public/ui/`.
Nothing in `art/` ships with the game.
