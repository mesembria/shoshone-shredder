// The fork's and shock's motion, for the look only: it never feeds back into the ride (the ride decides bottoming out in
// src/rules/suspension.ts; this only shows it). x is the share of travel used: 0 topped out, 1 on the bump stop, below 0
// stretched (a manual lifting the front).
import type { SpringKind } from '../rules/bikes';

export interface Spring { x: number; v: number; deepest: number }
export interface SpringTune { suspStiff: number; suspDamp: number }

const MIN_X = -0.3, SLICE = 1 / 120;
export const createSpring = (): Spring => ({ x: 0, v: 0, deepest: 0 });
export function resetSpring(sp: Spring): void {
  sp.x = sp.v = sp.deepest = 0;
}

// An air spring ramps up steeply toward the end of its travel; a coil stays linear, so it sinks deeper on the same hit.
const ramp = (x: number, kind: SpringKind) => (kind === 'air' ? 1 + 4 * Math.max(0, x) ** 3 : 1);

// Small slices, so a slow frame can't blow it up.
export function stepSpring(sp: Spring, dt: number, rest: number, kind: SpringKind, t: SpringTune): void {
  for (let left = dt; left > 1e-6; left -= SLICE) {
    const h = Math.min(left, SLICE);
    sp.v += (-t.suspStiff * (sp.x - rest) * ramp(sp.x, kind) - t.suspDamp * sp.v) * h;
    sp.x += sp.v * h;
    if (sp.x >= 1) {
      sp.x = 1; // the bump stop
      if (sp.v > 0) sp.v = 0;
    } else if (sp.x < MIN_X) {
      sp.x = MIN_X;
      if (sp.v < 0) sp.v = 0;
    }
    if (sp.x > sp.deepest) sp.deepest = sp.x;
  }
}

// The kick that makes a landing from rest peak at about `used` of the travel; all of it or more slams into the stop.
// Searched once per kick size, kind and spring setting, then remembered: pumping and landings ask for the same few.
const kicks = new Map<string, number>();
export function landKick(used: number, kind: SpringKind, t: SpringTune): number {
  const key = `${used.toFixed(3)} ${kind} ${t.suspStiff} ${t.suspDamp}`;
  const known = kicks.get(key);
  if (known !== undefined) return known;
  const v = searchKick(used, kind, t);
  if (kicks.size > 500) kicks.clear();
  kicks.set(key, v);
  return v;
}
function searchKick(used: number, kind: SpringKind, t: SpringTune): number {
  const target = used >= 1 ? 1.2 : Math.max(0, used);
  const peakFor = (v: number) => {
    const sp: Spring = { x: 0, v, deepest: 0 };
    for (let i = 0; i < 90 && sp.v >= 0; i++) stepSpring(sp, SLICE, 0, kind, t);
    return sp.x >= 1 ? 1 + sp.v / 10 : sp.deepest; // past the stop the peak can't grow, so count the leftover speed
  };
  if (target >= 1) {
    let v = 1;
    while (peakFor(v) < 1 && v < 1e3) v *= 1.5;
    return v * 1.2;
  }
  let lo = 0, hi = 1;
  while (peakFor(hi) < target && hi < 1e3) hi *= 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (peakFor(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
