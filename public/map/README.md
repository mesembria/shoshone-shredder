# The map picture

Put the map here as `public/map/colorado.png`. The game shows it full screen on each rider's map (the home screen),
cropped to cover the screen, so make it **landscape, 4:3**. Until the file exists the game draws a plain stand-in map.

The picture is background only. The places (Garage, Shop, Shredder Hills) are buttons the game draws on top, at
positions stored in the code as fractions of the picture's width and height (`AREAS[].map` in `src/game/areas.ts`,
and the Garage and Shop in `src/game/hub/map.ts`). If a button lands on something busy in the new picture, nudge
those numbers; adding a place never needs new art.

## Nano Banana edit prompt (fix the first try, keep its style)

Give Nano Banana the first picture along with this:

> Keep this picture's exact style, colors, lighting and camera angle, and keep the snowy mountains, the forests, the
> city, the town, the lake and the farm fields where they are. Fix three things. North is up and west is left.
> 1. The highway is I-70, which runs east–west. Remove the road that runs up and down along the mountains. Draw one
>    highway coming in from the right (east) edge near the bottom of the picture, crossing the plains, then climbing
>    west up a narrow canyon through the foothills and winding into the snowy mountains toward a small ski town at
>    the left edge.
> 2. Remove the big mesa standing in the middle of the plains. Put a few low, flat-topped, grassy mesas right at the
>    foot of the mountains, just south of (below) the red rock slabs, joined to the foothills, with a dirt trail
>    running north–south along them.
> 3. The Flatirons: replace the loose red blocks with a row of three to five huge, smooth, triangular slabs of
>    reddish-tan sandstone, side by side, leaning steeply against the east face of one forested mountain. Their
>    pointed tips aim up toward that mountain's summit, pine forest fills the gaps between them, and a green meadow
>    lies at their base, just southwest of the city.
> No text, no labels, no road signs, no people.

## Nano Banana prompt (from scratch)

> A whimsical illustrated map of Colorado's Front Range, seen from above at a slight angle, like a board game or a toy
> diorama. Chunky, rounded, low-poly shapes with soft matte colors and warm late-afternoon sun with soft shadows. North
> is up. On the left (west), snowy mountain peaks along the Continental Divide, with pine forests and a small ski town.
> In the middle, forested foothills run north–south. Against the east face of one foothill mountain, a row of three to
> five huge, smooth, triangular slabs of reddish-tan sandstone (the Flatirons) lean steeply side by side, tips aiming up
> at the summit, with pine forest between them and a green meadow at their base. A small city sits at the foot of the
> mountains just northeast of the slabs. Just south of the slabs, low flat-topped grassy mesas join the foot of the
> mountains, with a dirt trail running north–south along them. One highway (I-70) runs east–west: it comes in from
> the right edge near the bottom, crosses the plains, then climbs west up a narrow canyon through the foothills and
> winds into the snowy mountains to the ski town. No highway runs north–south along the mountains. On the right
> (east), rolling golden-green plains with a small town, a lake, farm fields and cottonwood trees. Sky blue at the
> top edge. Colors: sage green #8fae5a, forest green #3f6b3a, warm sand #ddd1b2, stone #b5a891, lake blue #8fb0de,
> cream #f2f0eb, red-brown rock #4a3a35. Leave open, uncluttered ground in the plains, the mesas, the foothills and the
> mountains, so buttons can be placed on top. No text, no labels, no letters, no road signs, no people. Landscape,
> 4:3, high resolution.
