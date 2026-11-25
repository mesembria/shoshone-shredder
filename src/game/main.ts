// Shoshone Shredder: one page, /play.html, with two modes. The hub: "Who's riding?" and each rider's map of Colorado
// (src/game/hub/). The ride: Shredder Hills, where you ride into a glowing ring to take on that spot's challenge, earn
// cogs for new stars, and swap between the bikes you own on the spot. Each bike has its own air tricks (bikeTricks.ts).
// The URL picks the mode, and moving between them is a real page load:
//   /play.html → Who's riding?   ?rider=<0|1> → that rider's map (out of range → Who's riding?)
//   ?rider=i&go=<challengeId> → ride straight into that challenge's countdown   ?rider=i&at=<station> → just ride there
//   ?rider=i&view=garage → that rider's Garage (Back goes to the map)
//   ?rider=i&view=shop → that rider's Shop (Back goes to the map)
//   ?bike=<id> → ride as rider 1 on that bike without saving it (?at= and ?go= work with it too)
// ?slow=0.25 is slow motion; ?autoland=0 turns off auto-land; ?debug shows fps; ?tune=1 brings back the Tune drawer
// and its saved values (for the grown-up and the browser checks; without it a ride is the bike's own numbers only).
// A ride is in one of two places: Shredder Hills (the trails) or Mesa Jump Park. ?go= and ?at= pick the place their spot is in;
// an old or unknown ?at= (Street, Hill top, ...) rides from the hill's trailhead.
import '../style.css';
import '../lab/lab.css';
import './game.css';
import * as THREE from 'three';
import { createSound, type Sound } from '../view/sound';
import { castDown } from '../world/physics';
import { createRide, type Ride } from '../lab/ride';
import type { LabState } from '../lab/bike';
import { T, DEFAULTS, loadTune, createPanel } from '../lab/tune';
import { CHALLENGES, DOWNHILL_BOOST, canStart, startRun, tick, trickTick, type ChallengeDef, type Run, type Status, type Tick } from './challenges';
import { loadGame, saveGame, loadoutOf, payFor, rideBike, freshBike, starPays, type Profile } from './progress';
import { AREAS } from './areas';
import { inZone } from '../world/trail';
import { applyLoadout } from './catalog';
import { airHints } from './unlocks';
import { EMPTY_COMBO } from '../rules/tricks';
import { toNextStar, newlyOpenAnywhere, openedLine, nextStarStrip, resultStrip, goalTag, starMedals } from './targets';
import { signHtml, nameHtml, stripHtml, paintStrip, setText, setHidden, medalsHtml, starHtml } from './pieces';
import { LAB_BIKES, LAB_ORDER, RIDE_KEYS, withLabRear, type LabBikeId } from '../lab/bikes';
import { createPlankWatch, lapEvent, runEvent, type Where } from './spots';
import { bindPresses } from '../input/press';
import { metresLeft, routeTick, startTrack, type RouteTrack } from './stayOnTrail';
import { showWho } from './hub/who';
import { showGarage } from './hub/garage';
import { showShop } from './hub/shop';
import { showMap, pageUrl, areaList, areaHead, ringCard, placeName, sym, COG } from './hub/map';
import { homeFor, placeOfStation } from '../world/places/data';

// every stylesheet above (and the hub screens' own, imported with them) is in by now: show the page (play.html hides
// it until then, so a page load never flashes unstyled text)
document.body.classList.add('styled');

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const store = window.localStorage;
const game = loadGame(store);
const WELCOMED = 'shredder-welcomed-2'; // rider names that have seen the welcome card (kept apart from the save)
const OLD_WELCOMED = 'shredder-welcomed'; // the old build's list: those riders had a save that was reset, so they get a "fresh start" line

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isBike = (id: string | null): id is LabBikeId => id !== null && Object.prototype.hasOwnProperty.call(LAB_BIKES, id);

// ---- which mode

const who = document.getElementById('who')!, hub = document.getElementById('hub')!;
const quickBike = params.get('bike');
const riderParam = params.get('rider') ?? '';
const rider = /^\d$/.test(riderParam) && Number(riderParam) < game.riders.length ? Number(riderParam) : -1;
if (isBike(quickBike)) ride(0, quickBike); // the quick start for the grown-up and the browser checks
else if (rider < 0) {
  hub.remove();
  showWho(who, store, (i) => (location.href = pageUrl({ rider: i })));
} else if (params.has('go') || params.has('at')) ride(rider);
else if (params.get('view') === 'garage') {
  who.remove();
  showGarage(hub, store, rider);
} else if (params.get('view') === 'shop') {
  who.remove();
  showShop(hub, store, rider);
} else {
  who.remove();
  showMap(hub, store, rider);
}

// The ride, with "Rolling out…" while the park loads. Audio can only start from a tap, and the tap that brought us
// here was on the page before, so it starts on the first tap here.
function ride(index: number, bike?: LabBikeId): void {
  hub.remove();
  who.className = 'loading';
  who.innerHTML = '<h1>Shoshone Shredder</h1><p class="loading-note">Rolling out…</p>';
  const sound = createSound();
  window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  // Back (or a swipe back) can restore a ride from the back-forward cache, frozen as it was: start it again from the
  // save instead (cogs may have been earned since), which also ends a countdown left running
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
  void start(index, sound, !!bike, bike).then(() => who.remove());
}

// ---- riding

// quick: started with ?bike=, so the rider's bike is never saved
async function start(index: number, sound: Sound, quick: boolean, bikeOverride?: LabBikeId): Promise<void> {
  // ?bike= rides any bike stock (and can swap among all of them); never saved
  let me: Profile = bikeOverride
    ? { ...game.riders[index], riding: bikeOverride, bikes: Object.fromEntries(LAB_ORDER.map((b) => [b, freshBike(b)])) }
    : game.riders[index];
  // every ride starts from the defaults and the bike's own numbers; saved Tune values only with ?tune=1 (and a bike's own
  // numbers still beat them)
  const tuning = params.get('tune') === '1';
  Object.assign(T, DEFAULTS);
  if (tuning) loadTune();
  applyLoadout(loadoutOf(me));
  // the bike as ridden: with ?tune=1 the drawer can try another rear design on it (T.labRear)
  const rideSpec = () => (tuning ? withLabRear(loadoutOf(me).spec, T.labRear) : loadoutOf(me).spec);
  // ?go=<id>: straight into that challenge's countdown, from its spot (only if the rider could start it from the map)
  const goDef = CHALLENGES.find((c) => c.id === params.get('go'));
  const go = goDef && canStart(me, goDef, loadoutOf(me)) ? goDef : null;
  const home = homeFor(go?.spot ?? params.get('at')), startAt = home.station;
  const AREA = AREAS.find((a) => a.id === home.place) ?? AREAS[0];
  const overlay = document.getElementById('lab')!;

  let restarting: ChallengeDef | null = null; // a Park challenge a wipeout is about to start again
  let run: Run | null = null, status: Status = { state: 'running', progress: '' };
  let modal: 'sheet' | 'card' | 'countdown' | null = null;
  let tuneOpen = false;
  let insideSpot: string | null = startAt; // the ring we're in (or just warped to), so it doesn't pop up again
  let airFromLip = false, wasCrash = false;
  let prevWhere: Where = { x: 0, y: 0, z: 0, grounded: true }, plank = createPlankWatch([]);
  // a timed run's progress along its route (stay on the trail): from its start line until the run ends; ended keeps the
  // last one for the result card's how-close line
  let track: RouteTrack | null = null, ended: RouteTrack | null = null;
  let ride: Ride | null = null;

  const where = (s: LabState): Where => ({ x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: s.grounded });

  ride = await createRide(document.getElementById('game') as HTMLCanvasElement, {
    bike: rideSpec(),
    start: startAt,
    overlay,
    sound,
    timeScale: Number(params.get('slow')) || 1,
    autoLand: params.get('autoland') !== '0',
    debug: params.has('debug'),
    place: home.place,
    hooks: {
      // Again in a challenge (or while a Park wipeout waits to restart) starts it over from its start, with the clock
      // back at 0; doing nothing gets you up where you fell, the run still going. Outside a challenge Again is the
      // usual hop back to the last run-up
      intent(i) {
        const def = run?.def ?? restarting;
        if (!i.again || !def || modal) return;
        i.again = false;
        startChallenge(def);
      },
      step(ev, s) {
        if (!s.grounded && s.air) airFromLip = s.air.line !== null;
        const crashStart = !!s.crash && !wasCrash;
        wasCrash = !!s.crash;
        if (!run) return;
        const w = where(s);
        const k: Tick = { dt: STEP, ...trickTick(ev.banked, s.combo), landed: ev.landed ?? (crashStart ? 'wipeout' : undefined), airTime: ev.airTime };
        if (ev.landed) k.fromLip = airFromLip;
        if (run.def.goal.kind === 'lap') k.lap = (ride?.course.pumpTrack && lapEvent(prevWhere, w, ride.course.pumpTrack)) || undefined;
        if (run.def.goal.kind === 'plank') k.plank = plank(w) ?? undefined;
        if (run.def.goal.kind === 'run' && ride) {
          // the start line starts the route; from then on the route says when the finish counts, the top, and a cut
          const e = runEvent(run.def.id, prevWhere, w, ride.course.runs);
          if (!track) {
            if (e === 'start') {
              track = startTrack(ride.course.runs[run.def.id].route);
              k.run = 'start';
            }
          } else {
            const c = routeTick(track, s, prevWhere, e === 'finish');
            if (c.finish) k.run = 'finish';
            if (c.top) k.top = true;
            if (c.cut) {
              ride.crashBack(c.at!);
              ride.hud.callout({ text: 'You cut the trail!', sub: 'back where you left it', tone: 'bad' });
            }
          }
        }
        k.left = !inZone(r.course.zones[run.def.spot], w.x, w.z);
        prevWhere = w;
        handle(tick(run, k));
      },
      gate(i) {
        if (run?.def.goal.kind === 'gates') handle(tick(run, { dt: 0, gate: i }));
      },
      frame: () => frame(),
    },
  });
  const r = ride;
  const { s } = r;

  // ---- overlays
  overlay.insertAdjacentHTML(
    'beforeend',
    `<div class="labels"></div>
    <div class="menu"><button class="m-map">🗺 Map</button><button class="m-area">📍 ${esc(AREA.name)}</button></div>
    <div class="runhud" hidden><div class="sign-slot"></div><div class="tag" hidden><span class="tag-t"></span><span class="pips"></span></div><div class="strip-slot"></div><span class="chip-left" hidden></span></div>
    <button class="b-stop" hidden>Stop</button>
    <div class="countdown"></div>
    <div class="count-medals" hidden></div>
    <div class="sheet area" hidden></div>
    <div class="card" hidden></div>`,
  );
  const $ = <E extends HTMLElement>(sel: string) => overlay.querySelector<E>(sel)!;
  // the run's HUD: the sign, the goal tag and the next-star strip up top (from the 3-2-1 to the end of the run), Stop top
  // right, and the star medals under the 3-2-1
  const runHud = $('.runhud'), tag = $('.runhud .tag'), tagText = $('.runhud .tag-t'), pipsEl = $('.runhud .pips');
  const chipLeft = $('.runhud .chip-left'), stopBtn = $('.b-stop');
  let stripEl: HTMLElement | null = null;
  const countEl = $('.countdown'), countMedals = $('.count-medals'), sheet = $('.sheet'), card = $('.card'), labelsEl = $('.labels');

  // ---- Swap (and Tune, only with ?tune=1)
  const swapBtn = document.createElement('button');
  swapBtn.className = 'swap';
  const owned = () => LAB_ORDER.filter((b) => me.bikes[b]); // only bikes the rider owns
  // out of the way whenever something is open: it would sit over the Tune drawer's station buttons, or a card; and
  // nothing to swap to with one bike
  const drawSwap = () => {
    swapBtn.hidden = owned().length < 2 || tuneOpen || modal !== null;
    // and no Tune during the countdown: a warp from there would start the run somewhere else
    const toggle = overlay.querySelector<HTMLElement>('.tune-toggle');
    if (toggle) toggle.style.display = modal === 'countdown' ? 'none' : '';
  };
  const setModal = (m: typeof modal) => {
    modal = m;
    drawSwap();
  };
  // a warp, from the area list or the Tune drawer: ends a run quietly, and doesn't pop up the ring you land in
  // a station or challenge in the other place is a page load into that place (everything else in the URL stays)
  const elsewhere = (station: string) => {
    const place = placeOfStation(station);
    return place !== null && place !== home.place;
  };
  function travel(to: { at?: string; go?: string }): void {
    const q = new URLSearchParams(location.search);
    q.delete('at');
    q.delete('go');
    for (const [k, v] of Object.entries(to)) q.set(k, v);
    location.href = location.pathname + '?' + q.toString();
  }
  function warp(station: string): void {
    if (elsewhere(station)) return travel({ at: station });
    stopRun();
    r.teleport(station);
    insideSpot = station;
  }
  const panel = tuning
    ? createPanel(overlay, Object.keys(r.course.stations), {
        open: (o) => {
          tuneOpen = o;
          r.setPaused(o || modal !== null);
          drawSwap();
        },
        go: warp,
        reset: () => {
          applyLoadout(loadoutOf(me));
          r.setBike(rideSpec());
        },
        change: (key) => {
          if (key === 'labRear') r.setBike(rideSpec());
        },
      })
    : null;
  // names the bike you're riding: a button naming the next bike read as the wrong bike
  const drawSwapLabel = () => (swapBtn.innerHTML = `🚲 ${LAB_BIKES[me.riding].name}<small>tap to swap ▸</small>`);
  // the next bike you own, right where you are, at the same speed, with its own parts; a challenge carries on, on the
  // new bike (locks only gate starting)
  function swap(): void {
    const o = owned();
    if (o.length < 2) return;
    const next = o[(o.indexOf(me.riding) + 1) % o.length];
    update((p) => rideBike(p, next) ?? p); // saved: the next ride starts on it
    const l = loadoutOf(me);
    applyLoadout(l);
    r.setBike(rideSpec());
    panel?.refresh();
    drawSwapLabel();
    drawHints();
    drawRings(); // a stat lock may open or close on this bike
  }
  drawSwapLabel();
  overlay.append(swapBtn); // (pressed with the overlay's other buttons: see ---- buttons)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyT') panel?.toggle();
    if (e.code === 'KeyB' && !swapBtn.hidden) swap();
  });

  // A change to this rider (a swap, a payout), saved straight away (never for ?bike=). It applies to the profile as
  // saved now, not as this page loaded it: the other rider, or this one on another page, may have played since, and
  // only this rider's change is written over that.
  function update(change: (p: Profile) => Profile): void {
    if (quick) return void (me = change(me));
    const now = loadGame(store);
    me = now.riders[index] = change(now.riders[index]);
    saveGame(store, now);
  }
  const drawHints = () => r.controls.setAirHints(airHints());

  // ---- rings: a glowing circle and a column of light at each spot, with its name floating above
  const spots = Object.keys(r.course.rings).filter((spot) => CHALLENGES.some((c) => c.spot === spot));
  const defsAt = (spot: string) => CHALLENGES.filter((c) => c.spot === spot);
  const open = (c: ChallengeDef) => canStart(me, c, loadoutOf(me));
  const ringY: Record<string, number> = {};
  const rings: Record<string, { ring: THREE.Mesh; beam: THREE.Mesh; label: HTMLElement }> = {};
  const YELLOW_HEX = 0xffd34d;
  for (const spot of spots) {
    const { x, z } = r.course.rings[spot];
    const y = (castDown(r.phys, x, 40, z, 80)?.height ?? 0) + 0.06;
    ringY[spot] = y;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.15, 48), new THREE.MeshBasicMaterial({ color: YELLOW_HEX, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 7, 32, 1, true), new THREE.MeshBasicMaterial({ color: YELLOW_HEX, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(x, y + 3.5, z);
    r.look.scene.add(ring, beam);
    const label = document.createElement('div');
    label.className = 'spot-label';
    label.textContent = placeName(spot);
    labelsEl.append(label);
    rings[spot] = { ring, beam, label };
  }
  // a ring's name greys out while nothing there is open yet (stars won and bike swaps change it)
  function drawRings(): void {
    for (const spot of spots) rings[spot].label.classList.toggle('locked', !defsAt(spot).some(open));
  }
  drawRings();
  // the ring the rider is standing in (as far as "inside" goes: until they ride 5 m out of it)
  const ringHere = () => spots.find((sp) => Math.hypot(s.pos.x - r.course.rings[sp].x, s.pos.z - r.course.rings[sp].z) < 5) ?? null;
  // ---- in a slalom, the next gate to ride through: a bobbing arrow above it, a bar across its posts and a line
  // between them on the ground
  const YELLOW = new THREE.MeshBasicMaterial({ color: YELLOW_HEX });
  const nextGate = new THREE.Group();
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 16).rotateX(Math.PI), YELLOW);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1), YELLOW);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: YELLOW_HEX, transparent: true, opacity: 0.8, depthWrite: false }));
  nextGate.add(arrow, bar, line);
  nextGate.visible = false;
  r.look.scene.add(nextGate);
  function showNextGate(): void {
    const i = run?.def.goal.kind === 'gates' ? run.count : -1;
    const g = r.course.gates[i];
    nextGate.visible = !!g;
    if (!g) return;
    const len = g.a.distanceTo(g.b);
    nextGate.position.set((g.a.x + g.b.x) / 2, 0.06, (g.a.y + g.b.y) / 2);
    nextGate.rotation.y = -Math.atan2(g.b.y - g.a.y, g.b.x - g.a.x) + Math.PI / 2;
    bar.scale.z = len;
    bar.position.y = 1.0;
    line.scale.z = len;
    arrow.position.y = 2.1 + 0.25 * Math.sin(performance.now() / 180);
  }

  // ---- sheets and cards
  function openSheet(html: string): void {
    sheet.innerHTML = html;
    sheet.hidden = false;
    card.hidden = true;
    setModal('sheet');
    r.setPaused(true);
  }
  function openCard(html: string): void {
    card.innerHTML = html;
    card.hidden = false;
    sheet.hidden = true;
    setModal('card');
    r.setPaused(true);
  }
  function closeAll(): void {
    sheet.hidden = card.hidden = true;
    setModal(null);
    r.setPaused(tuneOpen);
  }

  // the area's list: the same grouped rows as the map's sheet (stars, next pay, Go or what opens it), then Just ride
  function areaHtml(): string {
    return `${areaHead(me, AREA, '<button class="close primary">Ride ▶</button>')}
      ${areaList(me, loadoutOf(me), AREA)}`;
  }

  // a ring's card: each challenge there, with Go, or its lock text instead
  // (cardSpot: the ring whose card is open, so a tab can redraw it)
  let cardSpot: string | null = null;
  function spotCard(spot: string, pick?: string): void {
    cardSpot = spot;
    openCard(ringCard(me, loadoutOf(me), defsAt(spot), pick));
  }

  const bigStars = (n: number) => `<div class="bigstars">${[0, 1, 2].map((i) => starHtml(i < n)).join('')}</div>`;
  // how far a run that didn't finish got, in kid words
  function howClose(f: Run): string {
    const g = f.def.goal;
    switch (g.kind) {
      case 'gates':
        return `${f.count} of ${g.count} gates`;
      case 'jumps':
        return f.count >= g.count ? `${Math.round(f.points)} of ${g.points[0]} trick points` : `${f.count} of ${g.count} jumps cleared`;
      case 'lap':
        return f.checked ? 'Round the far turn: nearly back!' : "You didn't reach the far turn";
      case 'plank': {
        const p = r.course.planks![0];
        if (f.on && s.pos.x >= p.x1) return `${Math.round(f.points)} of ${g.points[0]} trick points`;
        return f.on ? `${Math.max(0, Math.round(s.pos.x - p.x0))} of ${Math.round(p.x1 - p.x0)} m along the plank` : "You didn't get on the plank";
      }
      case 'run': {
        if (!f.on) return "You didn't cross the start";
        if (!ended) return '';
        const { m, to } = metresLeft(ended); // route metres from where you'd got to
        return `${Math.round(m)} m from the ${to}`;
      }
    }
  }
  // done: the sign, the stars as art, the strip frozen where the run ended (the time or points), how far from the next
  // star, what opened, and the cogs paid (none for ?bike=); failed: the sign, why, how close, and no cogs. Then Again,
  // the area's list (as the menu's 📍 button opens it), or Ride on
  function showResult(def: ChallengeDef, finished: Run, st: Status, paid: { cogs: number; newStars: number } | null, opened: string[]): void {
    const again = `<div class="buttons">${open(def) ? `<button class="again primary" data-c="${def.id}">${st.state === 'done' ? 'Again' : 'Try again'}</button>` : ''}<button class="m-area">📍 ${esc(AREA.name)}</button><button class="close">Ride on</button></div>`;
    const cogs = (n: number) => (quick ? '' : `<p class="earn${n ? '' : ' none'}">+${n} ${COG}</p>`);
    const sign = signHtml(nameHtml(def.name), sym(AREA));
    if (st.state === 'failed') return openCard(`${sign}<h2>${st.why}</h2><p class="how-close">${howClose(finished)}</p>${cogs(0)}${again}`);
    if (st.state !== 'done') return;
    sound.bank();
    const fresh = paid?.newStars ? `<p class="new">${paid.newStars === 1 ? 'New star!' : `${paid.newStars} new stars!`}</p>` : '';
    const next = toNextStar(def.goal, finished, st.stars), unlocked = openedLine(opened);
    const more = `${next ? `<p class="to-next">${next}</p>` : ''}${unlocked ? `<p class="opened">${nameHtml(unlocked)}</p>` : ''}`;
    openCard(`${sign}${bigStars(st.stars)}${fresh}<div class="frozen">${stripHtml(resultStrip(def.goal, finished, st.stars))}</div>${more}${cogs(paid?.cogs ?? 0)}${again}`);
  }

  // ---- running a challenge
  const RESTART_AFTER = 1200; // ms of wipeout before a Park challenge starts again
  function startChallenge(def: ChallengeDef): void {
    if (elsewhere(def.spot)) return travel({ go: def.id });
    stopRun();
    restarting = null;
    sheet.hidden = card.hidden = true;
    r.teleport(def.spot);
    insideSpot = def.spot;
    setModal('countdown');
    r.setPaused(true);
    const steps = ['3', '2', '1', 'GO!'];
    // the run's HUD at rest (empty bar or full fuse), so the run starts with the HUD it will have; and what each star
    // needs and pays, under the numbers: Go on the map and Again skip the ring's card, so every run shows it here
    $('.runhud .sign-slot').innerHTML = signHtml(nameHtml(def.name), sym(AREA));
    $('.runhud .strip-slot').innerHTML = stripHtml(nextStarStrip(def.goal, startRun(def)));
    stripEl = $('.runhud .ui-strip');
    tag.hidden = chipLeft.hidden = true;
    tagText.textContent = pipsEl.textContent = ''; // not the last run's
    runHud.hidden = false;
    countMedals.innerHTML = medalsHtml(starMedals(def.goal, starPays(me, def.id)));
    countMedals.hidden = false;
    document.body.classList.add('in-run'); // no Map, 📍 or free-ride score until the run ends
    const next = (i: number) => {
      countEl.textContent = steps[i];
      countEl.classList.remove('pop');
      void countEl.offsetWidth;
      countEl.classList.add('pop');
      sound.trick(i < 3 ? 1 : 6);
      if (i < 3) return void setTimeout(() => next(i + 1), 650);
      countMedals.hidden = true;
      setModal(null);
      r.setPaused(tuneOpen);
      s.combo = EMPTY_COMBO; // a combo ridden into the ring isn't this run's
      run = startRun(def);
      track = ended = null;
      status = { state: 'running', progress: '' };
      // a clean trick landing pushes the bike on, on Downhill runs only
      T.trickBoost = def.group === 'downhill' ? DOWNHILL_BOOST : 0;
      panel?.refresh();
      wasCrash = !!s.crash;
      prevWhere = where(s);
      plank = createPlankWatch(r.course.planks ?? []);
      stopBtn.hidden = false;
    };
    next(0);
  }
  // a run ends (finished, failed, stopped or warped away): no boost, and the ring it ends in (Hairpin Hollow ↑ finishes
  // 2 m from the ↓ ring) counts as one we're already inside, so its card doesn't pop up
  function hideRunHud(): void {
    runHud.hidden = stopBtn.hidden = countMedals.hidden = true;
    document.body.classList.remove('in-run');
  }
  function stopRun(): void {
    if (run) insideSpot = ringHere() ?? insideSpot;
    run = null;
    ended = track;
    track = null;
    hideRunHud();
    T.trickBoost = 0;
    panel?.refresh();
  }
  function handle(st: Status): void {
    if (!run) return;
    if (st.state === 'running') {
      status = st;
      return;
    }
    const finished = run;
    stopRun();
    // a wipeout on a Park challenge: let the crash play out a moment, then count down into it again from its start
    if (st.state === 'restart') {
      // the run's HUD stays up (no Map, 📍 or score flashing in for the 1.2 s), only Stop goes
      runHud.hidden = false;
      document.body.classList.add('in-run');
      restarting = finished.def;
      setTimeout(() => {
        if (restarting !== finished.def) return; // Again already started it over
        restarting = null;
        if (!run && !modal && !leaving) startChallenge(finished.def);
        else if (!run) hideRunHud(); // not starting again after all (a card opened): the HUD goes
      }, RESTART_AFTER);
      return;
    }
    // a new star pays its tier once, a repeat a little; saved straight away (?bike= shows the result, never pays)
    let paid: { cogs: number; newStars: number } | null = null;
    let opened: string[] = [];
    if (st.state === 'done' && !quick) {
      let before = me; // the save's profile just before paying (update reloads it), so 🔓 credits this run only
      update((p) => {
        before = p;
        const pay = payFor(p, finished.def.id, st.stars);
        paid = pay;
        return pay.profile;
      });
      drawRings();
      // a new star can open challenges that were locked: say which
      if ((paid as { newStars: number } | null)?.newStars) opened = newlyOpenAnywhere(before, me, loadoutOf(me), AREAS, AREA.id);
    }
    showResult(finished.def, finished, st, paid, opened);
  }

  // ---- buttons
  // 🗺 Map: back to this rider's map (?bike= has no rider of its own: Who's riding). A run in progress is dropped:
  // nothing is paid or saved; a second tap while the map loads does nothing
  let leaving = false; // (a page restored by Back reloads: see ride())
  function toMap(): void {
    if (leaving) return;
    leaving = true;
    stopRun();
    location.href = quick ? pageUrl() : pageUrl({ rider: index });
  }
  // every button on the overlay, Swap too, presses as its finger lifts, even with a thumb on the stick (a tap then
  // never makes a click: see input/press.ts)
  bindPresses(overlay, (el) => {
    if (el === swapBtn) return swap();
    if (el.classList.contains('m-map')) return toMap();
    if (modal === 'countdown') return;
    const def = CHALLENGES.find((c) => c.id === el.closest<HTMLElement>('[data-c]')?.dataset.c);
    if (el.classList.contains('m-area')) openSheet(areaHtml());
    else if (el.classList.contains('close')) closeAll();
    else if (el.classList.contains('b-stop')) stopRun();
    else if (el.dataset.tab && cardSpot) spotCard(cardSpot, el.dataset.tab);
    else if (def && (el.classList.contains('go') || el.classList.contains('again'))) {
      if (open(def)) startChallenge(def); // locks gate starting
    } else if (el.dataset.at) {
      warp(el.dataset.at);
      closeAll();
    }
  });

  // ---- each frame: the banner, the floating names, riding into a ring
  const v = new THREE.Vector3();
  function frame(): void {
    if (run && status.state === 'running') {
      const strip = nextStarStrip(run.def.goal, run), goal = goalTag(status.progress);
      if (stripEl) paintStrip(stripEl, strip);
      setHidden(tag, !goal.text);
      setText(tagText, goal.text);
      setText(pipsEl, goal.pips ? '●'.repeat(goal.pips[0]) + '○'.repeat(goal.pips[1] - goal.pips[0]) : '');
      setHidden(chipLeft, strip.left === null);
      if (strip.left !== null) setText(chipLeft, `${strip.left} s`);
    }
    showNextGate();
    const W = window.innerWidth, H = window.innerHeight, cam = r.look.camera;
    for (const spot of spots) {
      const { x, z } = r.course.rings[spot], { label, ring, beam } = rings[spot];
      ring.scale.setScalar(1 + 0.05 * Math.sin(performance.now() / 250));
      // the column of light marks the spot from afar, and fades up close so it never walls off the view
      const d = Math.hypot(x - s.pos.x, z - s.pos.z);
      (beam.material as THREE.MeshBasicMaterial).opacity = 0.16 * Math.min(1, Math.max(0, (d - 4) / 14));
      v.set(x, ringY[spot] + 7.6, z);
      const far = d > 70;
      v.project(cam);
      label.hidden = far || v.z > 1 || modal === 'sheet';
      if (!label.hidden) label.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -100%)`;
    }
    if (insideSpot && insideSpot in r.course.rings) {
      const ring = r.course.rings[insideSpot];
      if (Math.hypot(s.pos.x - ring.x, s.pos.z - ring.z) > 5) insideSpot = null;
    } else insideSpot = null;
    if (insideSpot || run || modal || tuneOpen || s.crash) return;
    const spot = spots.find((sp) => Math.hypot(s.pos.x - r.course.rings[sp].x, s.pos.z - r.course.rings[sp].z) < 2.3 && Math.abs(s.pos.y - ringY[sp]) < 2.5);
    if (!spot) return;
    insideSpot = spot;
    spotCard(spot);
  }

  drawHints();
  drawSwap();
  // the welcome card, once per rider (not for the ?bike= quick start, nor when Go brought us straight to a challenge)
  const names = (key: string): string[] => {
    try {
      const w = JSON.parse(store.getItem(key) ?? '[]');
      return Array.isArray(w) ? w : [];
    } catch {
      return [];
    }
  };
  const welcomed = names(WELCOMED);
  if (go) startChallenge(go);
  else if (!quick && !welcomed.includes(me.name)) {
    store.setItem(WELCOMED, JSON.stringify([...welcomed, me.name]));
    openCard(`<h2>Hi ${esc(me.name)}!</h2>
      ${names(OLD_WELCOMED).includes(me.name) ? '<p>Fresh start! New bikes and parts to earn.</p>' : ''}
      <p>Ride into a glowing ring to try a challenge. Earn ⚙ cogs, then spend them in the Shop.</p>
      <div class="buttons"><button class="close primary">Let's ride!</button></div>`);
  }
  (window as unknown as { __game: unknown }).__game = { ride: r, me: () => me, run: () => run, start: (id: string) => startChallenge(CHALLENGES.find((c) => c.id === id)!), modal: () => modal, track: () => track };
  (window as unknown as { __lab: unknown }).__lab = { s, T, DEFAULTS, rideKeys: RIDE_KEYS, course: r.course, teleport: r.teleport, pad: r.pad, look: r.look, swap, bike: () => me.riding };
}
