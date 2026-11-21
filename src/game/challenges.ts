// Challenges: a short goal at a spot. Ride into the spot's ring to start one; the game reports what happens each
// step (gates, landings, trick points, laps, run lines) and the run says whether it's still going, done (with 1 to 3
// stars) or failed. A lock (Need) only gates starting: tick never sees the profile or the bike, so swapping to a bike
// that fails the lock mid-run still finishes and pays.
import type { Outcome } from '../rules/crash';
import { comboTotal, type Combo } from '../rules/tricks';
import { LAB_ORDER, type LabBikeId } from '../lab/bikes';
import { loadout, partsFor, SHEETS, type Loadout } from './catalog';
import { STAT_NAMES, statsFor, type Stat } from './stats';
import { loadoutOf, type Profile } from './progress';
import { AREAS, areaStars } from './areas';

export type Group = 'trail' | 'downhill' | 'park';
export type Goal =
  | { kind: 'gates'; count: number; times: [number, number, number] } // time limit, then 2-star and 3-star times
  // Park stars are trick points: 1, 2 and 3 stars (finishing under the 1-star points isn't a clear)
  | { kind: 'jumps'; count: number; limit: number; points: [number, number, number] }
  | { kind: 'lap'; times: [number, number, number] }
  | { kind: 'plank'; limit: number; points: [number, number, number] }
  // start line to finish line: time limit, then 2-star and 3-star times; via: a top to reach first, on its route (the
  // route keeps you to the trail, so it's on the way: src/game/stayOnTrail.ts)
  | { kind: 'run'; times: [number, number, number]; via?: true };
// What opens a challenge: stars in its area, a stat the bike reaches (by the right bike or the right part), riding one
// of some bikes, or clearing other challenges first. hint replaces the made-up lock sentence.
export interface Need { stars?: number; stat?: [Stat, number]; bike?: LabBikeId[]; cleared?: string[]; hint?: string }
export interface ChallengeDef { id: string; name: string; group: Group; spot: string; tell: string; goal: Goal; need?: Need }

// The extra push (m/s) a clean trick landing gives on a Downhill challenge. Robots (checks/ladder-robots.ts), Goat Ladder
// down, enduro ridden well with tricks: boost 0 7.47 s, 3 7.48 s (no gain), 4 7.08 s, 5 6.90 s, 6 6.83 s. At 5 the tricks
// win about 0.6 s and 3 stars need them; 2 stars never do. Boulder Dash and Hairpin down have no jumps, so no boost.
export const DOWNHILL_BOOST = 5;

export interface Tick {
  dt: number;
  bank?: number; // a combo total banked this step (points × tricks, as free riding banks it)
  open?: number; // the combo total still open after this step (it counts if the run ends first)
  landed?: Outcome;
  airTime?: number;
  fromLip?: boolean; // the landing ended a jump off a lip, not a hop on the flat
  gate?: number; // a slalom gate ridden through
  lap?: 'start' | 'check'; // crossed the start line, or the far side of the loop
  plank?: 'on' | 'off' | 'end';
  run?: 'start' | 'finish'; // crossed a timed run's start or finish line (its route allows the finish)
  top?: true; // reached the top on a both-ways run's route
  left?: boolean; // rode away from the spot
}
// restart: a crash on a Park challenge; the ride takes you back to the start of it
export type Status = { state: 'running'; progress: string } | { state: 'done'; stars: 1 | 2 | 3 } | { state: 'failed'; why: string } | { state: 'restart' };
// points: banked combo totals plus the combo still open (Park stars read it); banked and open keep the two parts
export interface Run { def: ChallengeDef; t: number; points: number; banked: number; open: number; count: number; checked: boolean; on: boolean }

// The tick's trick fields from the bike: the ride and the robots both build them here, so they score alike
export function trickTick(banked: number | undefined, combo: Combo): { bank: number; open: number } {
  return { bank: banked ?? 0, open: comboTotal(combo) };
}

// Times and points start from the old challenges' and the robots' (checks/climb-robots.ts, downhill-robots.ts,
// showcase-robots.ts); Task 12 calibrates them all.
// Nov 8: Goat Ladder ↓ and Hairpin Hollow's three 2★ times moved for the whole hill (checks/ladder-robots.ts PLACE=hill),
// each between the hill's and the old park's bare hardtail and full-parts hardtail so the ladder rule holds on both.
export const CHALLENGES: ChallengeDef[] = [
  // ---- trail and downhill runs
  { id: 'goatUp', name: 'Goat Ladder ↑', group: 'trail', spot: 'Climb', tell: 'Ride to the top. Save your legs for the steep bits', goal: { kind: 'run', times: [120, 45, 38.5] } },
  { id: 'goatDown', name: 'Goat Ladder ↓', group: 'downhill', spot: 'Summit', tell: 'Race to the bottom. Hop the log! Land tricks to go faster', goal: { kind: 'run', times: [40, 9.8, 7.4] } },
  { id: 'goatBoth', name: 'Goat Ladder ↕', group: 'trail', spot: 'Climb', tell: 'Up to the top, then race back down', goal: { kind: 'run', times: [180, 60, 52], via: true }, need: { cleared: ['goatUp', 'goatDown'] } },
  { id: 'hairpinUp', name: 'Hairpin Hollow ↑', group: 'trail', spot: 'Switchbacks', tell: 'Climb to the top. Save your legs for the steep bits', goal: { kind: 'run', times: [120, 74.5, 63] }, need: { stars: 3 } },
  { id: 'hairpinDown', name: 'Hairpin Hollow ↓', group: 'downhill', spot: 'Switchbacks top', tell: 'Race down the hill. Brake before the hairpins, pop the step-downs', goal: { kind: 'run', times: [90, 34.25, 31.5] }, need: { stars: 3 } },
  { id: 'hairpinBoth', name: 'Hairpin Hollow ↕', group: 'trail', spot: 'Switchbacks', tell: 'Up to the top, turn round, race back down', goal: { kind: 'run', times: [240, 117, 104], via: true }, need: { cleared: ['hairpinUp', 'hairpinDown'] } },
  { id: 'boulderDash', name: 'Boulder Dash', group: 'downhill', spot: 'Rock chute', tell: 'Get to the bottom. Brake before the boulders!', goal: { kind: 'run', times: [40, 12, 10.5] }, need: { stars: 4, stat: ['stable', 5.9] } },
  // ---- park
  { id: 'tableSmall', name: 'Table Row Small', group: 'park', spot: 'Jumps S', tell: 'Clear all three tables. Tricks earn stars', goal: { kind: 'jumps', count: 3, limit: 30, points: [150, 12000, 36000] } },
  { id: 'tableMedium', name: 'Table Row Medium', group: 'park', spot: 'Jumps M', tell: 'Clear both tables. Tricks earn stars', goal: { kind: 'jumps', count: 2, limit: 30, points: [150, 7000, 20000] }, need: { stars: 2 } },
  { id: 'tableBig', name: 'Table Row Big', group: 'park', spot: 'Jumps L', tell: 'Clear the big table. Tricks earn stars', goal: { kind: 'jumps', count: 1, limit: 30, points: [200, 1800, 5500] }, need: { stars: 5 } },
  { id: 'tableXL', name: 'Table Row XL', group: 'park', spot: 'Jumps XL', tell: 'Clear the biggest table. Pop it hard', goal: { kind: 'jumps', count: 1, limit: 30, points: [200, 2200, 6500] }, need: { stars: 5 } },
  { id: 'whoop', name: 'Whoop-de-Doo', group: 'park', spot: 'Rhythm', tell: 'Clear five doubles without pedaling. Pump the backsides', goal: { kind: 'jumps', count: 5, limit: 30, points: [300, 35000, 65000] }, need: { stars: 4 } },
  { id: 'pumpHouse', name: 'The Pump House', group: 'park', spot: 'Pump track', tell: 'One lap, no pedaling. Hold Jump on the downhills', goal: { kind: 'lap', times: [45, 15.4, 14.6] }, need: { stars: 2 } },
  { id: 'coneZone', name: 'Cone Zone', group: 'park', spot: 'Slalom', tell: 'Ride through every gate', goal: { kind: 'gates', count: 10, times: [30, 14, 12.5] }, need: { stars: 1 } },
  { id: 'plank', name: 'The Plank', group: 'park', spot: 'Skinny', tell: 'Manual the narrow plank, hop the gap, manual again', goal: { kind: 'plank', limit: 20, points: [60, 300, 750] }, need: { stars: 2, stat: ['flick', 3.6] } },
];

// ---- locks

// Star locks count the stars on every challenge, in both places (not stale ids from older saves)
const starsHeld = (p: Profile) => AREAS.reduce((n, a) => n + areaStars(p, a), 0);
const statOf = (l: Loadout, s: Stat) => statsFor(l)[s];

export function canStart(p: Profile, def: ChallengeDef, l: Loadout): boolean {
  const n = def.need;
  if (!n) return true;
  if (n.cleared && !n.cleared.every((id) => (p.stars[id] ?? 0) > 0)) return false;
  if (n.stars && starsHeld(p) < n.stars) return false;
  if (n.bike && !n.bike.includes(l.bike)) return false;
  if (n.stat && statOf(l, n.stat[0]) < n.stat[1]) return false;
  return true;
}

const nameOf = (id: string) => CHALLENGES.find((c) => c.id === id)?.name ?? id;
// "Goat Ladder ↑" and "Goat Ladder ↓" read "Goat Ladder ↑ and ↓"
function andNames(names: string[]): string {
  const split = names.map((n) => [n.slice(0, n.lastIndexOf(' ')), n.slice(n.lastIndexOf(' ') + 1)]);
  if (names.length > 1 && split.every(([base]) => base && base === split[0][0])) return `${split[0][0]} ${split.map(([, end]) => end).join(' and ')}`;
  return names.join(' and ');
}

// Who could meet a stat, cheapest road first: the best other bike the rider owns as it's built, else an owned part for
// the bike being ridden, else the cheapest single part of it still in the shop, else the cheapest pair of its parts in two
// slots, and only then the best shop bike's stock (a bike costs far more than parts). "Meets" is canStart's own test.
function statTip(p: Profile, l: Loadout, [s, n]: [Stat, number]): string {
  const meets = (x: Loadout) => statOf(x, s) >= n;
  const best = <T>(xs: T[], v: (x: T) => number) => xs.map((x) => [x, v(x)] as const).filter(([, y]) => y >= n).sort((a, b) => b[1] - a[1])[0]?.[0];
  const owned = LAB_ORDER.filter((b) => p.bikes[b] && b !== l.bike);
  const bike = best(owned, (b) => statOf(loadoutOf(p, b), s));
  if (bike) return ` · try your ${SHEETS[bike].type}`;
  const fit = (...ps: { id: string; slot: string }[]) => loadout(l.bike, { ...l.fitted, ...Object.fromEntries(ps.map((x) => [x.slot, x.id])) });
  const parts = partsFor(l.bike).filter((x) => !x.stock && l.fitted[x.slot] !== x.id);
  const have = (x: { id: string }) => p.bikes[l.bike]?.parts.includes(x.id);
  const mine = best(parts.filter(have), (x) => statOf(fit(x), s));
  if (mine) return ` · fit your ${mine.name}`;
  const shopParts = parts.filter((x) => !have(x));
  const one = shopParts.filter((x) => meets(fit(x))).sort((a, b) => a.price - b.price)[0];
  if (one) return ` · get the ${one.name}`;
  // pairs may include a part already owned (it costs nothing); the hint names both either way
  const cost = (x: { id: string; price: number }) => (have(x) ? 0 : x.price);
  const pairs = parts.flatMap((x, i) => parts.slice(i + 1).filter((y) => y.slot !== x.slot && meets(fit(x, y))).map((y) => [x, y] as const));
  const pair = pairs.sort((a, b) => cost(a[0]) + cost(a[1]) - cost(b[0]) - cost(b[1]))[0];
  if (pair) return ` · ${have(pair[0]) && have(pair[1]) ? 'fit your' : 'get the'} ${pair[0].name} and ${pair[1].name}`;
  const shop = best(LAB_ORDER.filter((b) => !p.bikes[b]), (b) => statOf(loadout(b, {}), s));
  return shop ? ` · try the ${SHEETS[shop].type}` : '';
}

// One short kid sentence for the first thing still missing, or null when the challenge is open.
export function lockText(p: Profile, def: ChallengeDef, l: Loadout): string | null {
  if (canStart(p, def, l)) return null;
  const n = def.need!;
  if (n.hint) return n.hint;
  const left = (n.cleared ?? []).filter((id) => !((p.stars[id] ?? 0) > 0));
  if (left.length) return `Clear ${andNames(left.map(nameOf))} first`;
  if (n.stars && starsHeld(p) < n.stars) return `Ride ${n.stars} ★`;
  if (n.bike && !n.bike.includes(l.bike)) return `Needs the ${n.bike.map((b) => SHEETS[b].type).join(' or ')}`;
  if (n.stat) return `Needs ${STAT_NAMES[n.stat[0]]} ${n.stat[1]}${statTip(p, l, n.stat)}`;
  return null;
}

// ---- running a challenge

export function startRun(def: ChallengeDef): Run {
  return { def, t: 0, points: 0, banked: 0, open: 0, count: 0, checked: false, on: false };
}

const byPoints = (points: number, [one, two, three]: [number, number, number]): 0 | 1 | 2 | 3 => (points >= three ? 3 : points >= two ? 2 : points >= one ? 1 : 0);
const NO_TRICKS = 'Not enough tricks!';
const byTime = (t: number, [, two, three]: [number, number, number]): 1 | 2 | 3 => (t <= three ? 3 : t <= two ? 2 : 1);
const crashed = (o: Outcome | undefined) => o === 'wipeout' || o === 'big';
const landedClean = (o: Outcome | undefined) => o === 'clean' || o === 'bobble';

export function tick(run: Run, k: Tick): Status {
  const g = run.def.goal;
  run.t += k.dt;
  // A crash on a Park challenge starts it again from the beginning (the boys asked for it: a trick run with a wipeout
  // in it isn't worth finishing). On Trail and Downhill runs it costs time, not the run (the clock runs while you get
  // up on your own; Again starts it over from the start, see main.ts); they score no points
  if (crashed(k.landed) && run.def.group === 'park') return { state: 'restart' };
  run.banked += k.bank ?? 0;
  run.open = k.open ?? run.open;
  run.points = run.banked + run.open;
  if (k.left) return { state: 'failed', why: 'You left the spot' };
  switch (g.kind) {
    case 'gates':
      if (k.gate === run.count) run.count++;
      if (run.count >= g.count) return { state: 'done', stars: byTime(run.t, g.times) };
      return run.t > g.times[0] ? { state: 'failed', why: 'Out of time' } : { state: 'running', progress: `Gates ${run.count}/${g.count}` };
    case 'jumps':
      if (landedClean(k.landed) && k.fromLip && (k.airTime ?? 0) >= 0.35) run.count++;
      if (run.count >= g.count) {
        const stars = byPoints(run.points, g.points);
        return stars ? { state: 'done', stars } : { state: 'failed', why: NO_TRICKS };
      }
      return run.t > g.limit ? { state: 'failed', why: 'Out of time' } : { state: 'running', progress: `Jumps ${run.count}/${g.count}` };
    case 'lap':
      if (k.lap === 'check') run.checked = true;
      if (k.lap === 'start' && run.checked) return { state: 'done', stars: byTime(run.t, g.times) };
      return run.t > g.times[0] ? { state: 'failed', why: 'Out of time' } : { state: 'running', progress: run.checked ? 'Back to the start!' : 'Round the far turn' };
    case 'run': {
      if (k.run === 'start') run.on = true;
      if (run.on && k.top) run.checked = true;
      if (run.on && k.run === 'finish') return { state: 'done', stars: byTime(run.t, g.times) };
      return run.t > g.times[0] ? { state: 'failed', why: 'Out of time' } : { state: 'running', progress: !run.on ? 'Go!' : g.via && !run.checked ? 'To the top!' : 'To the finish!' };
    }
    case 'plank':
      if (k.plank === 'on') run.on = true;
      if (run.on && k.plank === 'off') return { state: 'failed', why: 'Fell off the plank' };
      if (run.on && k.plank === 'end') {
        const stars = byPoints(run.points, g.points);
        return stars ? { state: 'done', stars } : { state: 'failed', why: NO_TRICKS };
      }
      return run.t > g.limit ? { state: 'failed', why: 'Out of time' } : { state: 'running', progress: run.on ? 'Keep going!' : 'Get on the plank' };
  }
}
