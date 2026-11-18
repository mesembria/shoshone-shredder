# The mountain backdrop

Three pictures, `south.jpg`, `west.jpg` and `north.jpg` (`.png` works too), make one painted range around the west
side of the game's two places (the Shredder Hills trail hill and Mesa Jump Park), about 190° of the view, 640 m out. It is live in the game; `/play.html?look=foothills` still shows it on its own.

**After changing any of them, bake:** `npx vite-node scripts/bake-backdrop.ts` (about 20 seconds; needs ImageMagick).
It lines the side pictures up against west where they repeat its end strip, joins each along the seam where the two
agree best, cuts out the magenta sky, adds a little distance haze, sinks the far ends below the horizon (fading them
left a ghostly band in the sky), crops the empty top and the
pictures' own near meadow, and writes `baked/` (pieces at most 4096 px wide plus `info.json`). The game only reads
`baked/`. Baking on the Mac keeps the iPad from holding three 4K pictures (Safari also refuses canvases over about 16.7
million pixels). Without a bake the game paints a plain stand-in. How big the painting looks is `SPAN` and `SQUASH` in
`src/look/foothills.ts`, no re-bake needed.

`make/` holds the starter images for the side pictures and the first, smaller try at west.

Why the prompt asks for things low in the picture: the picture is stretched across a wide slice of the view, so its
height becomes very tall. If the peaks filled the whole picture, they'd tower over the rider. Peaks that stop at
about 40% of the height look like big mountains in the distance.

The light in the game comes from behind the rider and a little to the right when facing the mountains, so the
prompt asks for the same.

## Nano Banana prompt

Attach `public/map/colorado.png` as the style reference and use this:

> Use the attached picture only as a style reference: match its chunky, rounded, low-poly clay look and its soft matte
> colors. Don't copy its layout or its bird's-eye angle.
>
> Paint a wide panoramic backdrop for a toy diorama: Colorado's Front Range seen from eye level, standing on a golden
> grassy mesa and looking west at the mountains. Warm late-afternoon light comes from behind the viewer and a little
> to the right, so the faces of the mountains are lit.
>
> - Across the middle, a long range of snowy low-poly peaks, tallest near the center, getting lower toward both sides.
> - In front of them, rounded foothills covered in dark green pine forest.
> - In the right third, three to five huge, smooth, triangular slabs of reddish-tan sandstone (the Flatirons) lean
>   steeply side by side against the face of one forested foothill, tips pointing up, pine forest between them.
> - The bottom of the picture is far-off rolling golden grassland running straight across the bottom edge, with only
>   a few tiny scattered pines. Nothing large touches the bottom edge.
> - At the far left and far right edges, the land drops to low golden foothills only a little above the bottom, at the
>   same height on both sides.
> - Keep all of it low in the picture: the tallest peak stops at about 40% of the picture's height from the bottom.
> - Everything above the land is a flat, solid, pure magenta (#FF00FF) background: no sky, no clouds, no sun, no
>   haze, no gradient, no glow. No magenta or pink anywhere in the land.
>
> No text, no labels, no people, no roads, no buildings. Ultra-wide 21:9, the highest resolution available.

If it comes back with the peaks too tall, a sky instead of magenta, or the Flatirons missing, give Nano Banana the
picture back with one fix at a time ("Keep everything else exactly the same, but ...").

## Extending it north and south (so the ends don't fade out mid-mountain)

The game wraps three pictures side by side, about 190° in all: `south`, then `west`, then `north`. The
range curves down into low golden hills at both far ends, where it meets the game's own far hills.

The starter images in `make/` are west's end strip (30% of its width) on a gray canvas. Nano Banana fills the
gray, and because it can see the edge it's continuing, the join lines up. The bake lines the strips up and joins
them. **Keep the output the same 21:9 shape and don't crop it.** If Nano Banana offers 2K or 4K, use it for all three
(remake west at that size too, with "Keep this picture exactly the same, just at higher resolution").

**North** (attach `make/north-start.png`, save the result as `public/backdrop/north.jpg`):

> Fill in the gray area by continuing this exact scene to the right, in exactly the same style, scale, colors and
> light. Keep the part on the left exactly as it is. Moving right, the snowy mountain range keeps going but gets
> steadily lower, then gives way to forested foothills, which flatten into low, rolling golden grassland hills at the
> right edge, only a little above the bottom of the picture. No more sandstone slabs after the ones already there.
> Keep the same golden grassland along the bottom, with an occasional flat-topped grassy mesa. Everything above the
> land stays flat, solid, pure magenta (#FF00FF). No text, no people, no roads, no buildings. Same 21:9 size.

**South** (attach `make/south-start.png`, save the result as `public/backdrop/south.jpg`):

> Fill in the gray area by continuing this exact scene to the left, in exactly the same style, scale, colors and
> light. Keep the part on the right exactly as it is. Moving left, the snowy mountain range keeps going but gets
> steadily lower, then gives way to forested foothills, which flatten into low, rolling golden grassland hills at the
> left edge, only a little above the bottom of the picture. Keep the same golden grassland along the bottom, with an
> occasional flat-topped grassy mesa. Everything above the land stays flat, solid, pure magenta (#FF00FF). No text,
> no people, no roads, no buildings. Same 21:9 size.

Check each one before saving: is the strip on the kept side unchanged? Do the far end's hills come down low? Is the
sky still flat magenta?
