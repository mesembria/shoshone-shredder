// The eight 0..10 bars the kids see. Each is a fixed blend of a few Tune settings (and the bike's trick spin), mostly
// scaled to that setting's slider range in the lab so stacked parts cannot run a bar off the end. Every setting a part
// moves feeds some bar, so a part's cost always shows (tests/stats.test.ts): pickup is in Speed, how much a skid slows
// you is in Grip, and quick steering and tight turns are in Flick (the reviews' "flickable"), against Stable.
import type { Loadout } from './catalog';

export type Stat = 'climb' | 'speed' | 'grip' | 'stop' | 'stable' | 'plow' | 'pop' | 'flick';
export const STAT_GROUPS: { name: 'Trail' | 'Downhill' | 'Park'; stats: Stat[] }[] = [
  { name: 'Trail', stats: ['climb', 'speed'] },
  { name: 'Downhill', stats: ['grip', 'stop', 'stable', 'plow'] },
  { name: 'Park', stats: ['pop', 'flick'] },
];
export const STAT_NAMES: Record<Stat, string> = {
  climb: 'Climb', speed: 'Speed', grip: 'Grip', stop: 'Stop', stable: 'Stable', plow: 'Plow', pop: 'Pop', flick: 'Flick',
};

const share = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo))); // 0..1 along a range
const less = (v: number, lo: number, hi: number) => 1 - share(v, lo, hi); // lower is better

export function statsFor(l: Loadout): Record<Stat, number> {
  const t = l.tune;
  // a single-gear bike stops gaining speed at gearTop (0 = real gears)
  const top = t.gearTop > 0 ? Math.min(t.sprint, t.gearTop) : t.sprint;
  const raw: Record<Stat, number> = {
    // legs, energy cost and a single gear's bog, over the range the bikes span (a small legs part rides a lot better)
    climb: 0.5 * share(t.legs, 3, 6) + 0.3 * less(t.energyCost, 0.5, 1.5) + 0.2 * less(t.gearBog, 0, 0.6),
    // top speed, getting going (pickup, over the range the bikes span) and rolling resistance
    speed: 0.4 * share(top, 5, 14) + 0.2 * share(t.maxSpeed, 8, 25) + 0.25 * less(t.rolling, 0, 0.4) + 0.15 * share(t.pedalAccel, 2, 8),
    grip: 0.45 * share(t.grip, 3, 20) + 0.25 * share(t.bermGrip, 0, 2) + 0.15 * share(t.looseLimit, 0, 1) + 0.15 * less(t.skidDecel, 0, 10),
    stop: share(t.brake, 2, 20),
    stable: 0.45 * share(t.wobbleSpeed || 25, 0, 25) + 0.35 * less(t.wobbleKick, 0, 2) + 0.2 * less(t.steerResponse, 3, 40),
    plow: 0.4 * share(t.plowSize, 0, 0.6) + 0.2 * share(t.popSoak, 0, 0.9) + 0.4 * share(t.rockCrash, 2, 20),
    pop: 0.5 * share(t.hopFull, 3, 10) + 0.25 * share(t.lipPop, 0, 1.5) + 0.25 * less(t.popSoak, 0, 0.9),
    // spin in the air, quick steering, tight turns (steering and turns over the range the bikes span)
    flick: 0.5 * share(l.spec.spin, 0.3, 1.6) + 0.25 * share(t.steerResponse, 5, 25) + 0.25 * less(t.minRadius, 0.8, 2.5),
  };
  const out = {} as Record<Stat, number>;
  for (const s of Object.keys(raw) as Stat[]) out[s] = Math.round(raw[s] * 100) / 10;
  return out;
}
