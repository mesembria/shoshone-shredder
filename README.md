# Shoshone Shredder: Phase 0

One street, two bikes, four tricks. A feel prototype for the boys' iPads.

## Run it

You need Node 20 or newer.

    npm install
    npm run dev

Vite prints a Network address such as `http://192.168.1.20:5173`. Open it in
Safari on an iPad on the same Wi-Fi, then Share, Add to Home Screen.

## Two pages

- `/play.html` is the game. Pick who's riding, then the map of Colorado: ride Shredder Hills'
  challenges for stars and cogs (⚙), spend them in the Shop, and hang parts on
  your bike in the Garage. Rings in the park start the challenges; swap between the
  bikes you own on the spot (🚲). Each rider's progress is saved on that iPad.
- `/` is the first prototype: one street, two bikes, four tricks.

`/lab.html` (the old feel lab) now redirects to `/play.html`, keeping its query
string, so old home-screen icons still work.

## Handy extras

On `/play.html`:

- `?bike=enduro` (or `hardtail`, `dirtjumper`, `bolinas`) skips "Who's riding?" and rides
  as rider 1 on that bike, without saving it
- `?rider=0`, `?rider=0&go=coneZone`, `?rider=0&view=garage` and `&view=shop` jump to a
  rider's map, a challenge, the Garage or the Shop
- `?tune=1` brings back the Tune drawer (for the grown-up)
- `?at=Summit` starts at a station (any name in the Tune drawer)
- `?slow=0.25` is slow motion
- `?autoland=0` turns off auto-land
- `?debug` shows fps, draw calls and render scale

On `/`: `?debug`, `?start=park` (starts at the park kicker), `?slow=`, `?autoland=0`.

On the iPad: left thumb steers (drag sideways), pedals harder (up) and brakes
(down). Pull down and to one side to skid the back wheel round a sharp turn.
Right thumb taps to hop, holds to pop higher, swipes for tricks.

On a laptop: arrows steer and set speed, Down plus Left or Right skids,
Space hops (hold for more), I is a no-hander, J or L a tabletop, K a manual,
R is Again.

## Releasing for the boys

The boys play a deployed build on Cloudflare Pages, so it only changes when you release.

    npx wrangler login        # once
    npm run release:setup     # once: creates the Pages project (production branch: main)
    npm run deploy:preview    # try it on the iPad at https://preview.shoshone-shredder.pages.dev
    npm run release           # checks, tests, builds, then deploys to the boys' URL (main)

Which URL is which:

- Boys: `https://shoshone-shredder.pages.dev/play` (changes only on `npm run release`)
- Testing: `https://preview.shoshone-shredder.pages.dev/play` (changes on `npm run deploy:preview`)
- Pages redirects `/play.html` to `/play`, so `curl` needs `-L`.

Check a deploy went up: the `/assets/play-<hash>.js` named in the live page's source (Safari: view source, or
`curl -sL <url>/play | grep -o '/assets/play-[^"]*'`) should match `dist/assets/` after the build. Cloudflare
serves the page with `must-revalidate` and the assets have hashed names, so it doesn't serve stale copies. If the
hash matches but the iPad still shows the old game, the iPad is holding an old page: open the URL in a private
Safari tab, or delete the Home Screen icon and add it again (tap 💾 Backup, then Copy first, as below). The dev
server at `:5173` never gets deployed code.

Saves live in each browser, per address. Moving to a new address starts empty: on the old one tap
💾 Backup on the Who's-riding screen, Copy, then on the new one paste into the box and Restore.

## Notes

- `docs/handoff-2026-11-01.md`: where things stand, decisions, playtest notes, open threads. Read it first.
- `docs/spec-draft-2.md`: the design spec (Draft 2).
- `checks/`: robot riders (`npx vite-node checks/<file>.ts`) and headless browser checks
  (`node checks/<file>.mjs`, with the dev server running). The handoff lists what each one checks;
  `checks/ladder-robots.ts` is the star-ladder calibration for challenges and parts.
- `public/map/README.md`: where the map picture goes (`public/map/colorado.png`).

## Check it

    npm run check   # types
    npm test        # 263 tests
    npm run build   # production build in dist/
