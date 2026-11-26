// The robots' steering on curved trails: aim at a point and turn toward it, the way every robot always has (three
// times the heading error, held to full lock).
import type { Trail } from '../src/world/trail';
import { castDown, type Physics } from '../src/world/physics';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// the steer in [-1, 1] that turns a bike at (x, z) heading yaw toward (tx, tz)
export function steerToward(x: number, z: number, yaw: number, tx: number, tz: number): number {
  const err = wrap(Math.atan2(-(tz - z), tx - x) - yaw);
  return Math.max(-1, Math.min(1, -err * 3));
}

// the steer toward the trail's centreline `ahead` metres further along it than where the bike is
export function pathSteer(t: Trail, x: number, z: number, yaw: number, ahead = 3): number {
  const p = t.path.at(Math.min(t.path.length, t.path.nearest(x, z).u + ahead));
  return steerToward(x, z, yaw, p.x, p.z);
}

// the trail's centreline carried on straight past its end, so a robot aiming ahead at the bottom keeps going
export function pastEnd(t: Trail, u: number): { x: number; z: number } {
  const L = t.path.length, p = t.path.at(Math.min(u, L)), over = Math.max(0, u - L);
  return { x: p.x + over * Math.cos(p.yaw), z: p.z - over * Math.sin(p.yaw) };
}

// ---- the line round the rocks along a curved trail, shared by the climb, downhill, showcase and ladder robots

// The probe for rocks, stretched along the trail's heading: true when anything solid is under the ring of points
// round (x, z) (a ring of `n` points at radius 0.3 and `rMax`, stretched `r1` times along `yaw`, ground cast from
// `from` down `depth`). `rockOk` clears a rock that's fine to ride over (a log that's hopped); `also` adds blocks.
export interface ProbeOpts { r1: number; rMax: number; n: number; from: number; depth: number; rockOk?: (x: number, z: number) => boolean; also?: (x: number, z: number) => boolean }
export const blockedProbe = (phys: Physics, o: ProbeOpts) => (x: number, z: number, yaw: number): boolean => {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  for (const r of [0, 0.3, o.rMax]) for (let k = 0; k < (r ? o.n : 1); k++) {
    const a = (k / o.n) * Math.PI * 2, ca = r * Math.cos(a) * o.r1, sa = r * Math.sin(a), px = x + ca * fx - sa * fz, pz = z + ca * fz + sa * fx;
    const h = castDown(phys, px, o.from, pz, o.depth);
    if (h && (h.surface === 'wall' || (h.surface === 'rock' && !(o.rockOk && o.rockOk(px, pz))))) return true;
    if (o.also && o.also(px, pz)) return true;
  }
  return false;
};

// The sideways offsets tried across a trail: -spread to spread, 0.1 m apart.
export const offsetsAcross = (spread: number): number[] => {
  const D: number[] = [];
  for (let d = -spread; d <= spread + 1e-6; d += 0.1) D.push(d);
  return D;
};

// Dynamic programming over sideways offsets: the line along u0..u1 (every 0.25 m) that costs least, where `cost(u, d)` is
// the price of being d to the right at u, a step may change offset by up to `window` slots (0.4 a slot), `startBias`
// and `endBias` weigh the offset at the first and last point, and `point(u, d)` is where that is.
export function planLine<P>(u0: number, u1: number, D: number[], cost: (u: number, d: number) => number, point: (u: number, d: number) => P, o: { window: number; startBias?: number; endBias?: number }): P[] {
  const N = Math.floor((u1 - u0) / 0.25), sb = o.startBias ?? 0, eb = o.endBias ?? 0;
  const total: number[][] = [], from: number[][] = [];
  for (let i = 0; i <= N; i++) {
    const u = u0 + i * 0.25;
    total.push([]); from.push([]);
    for (let j = 0; j < D.length; j++) {
      const c = cost(u, D[j]);
      if (i === 0) { total[0].push(c + sb * Math.abs(D[j])); from[0].push(-1); continue; }
      let best = 1e12, bj = -1;
      for (let k = Math.max(0, j - o.window); k <= Math.min(D.length - 1, j + o.window); k++) {
        const v = total[i - 1][k] + 0.4 * Math.abs(k - j);
        if (v < best) { best = v; bj = k; }
      }
      total[i].push(best + c); from[i].push(bj);
    }
  }
  let j = 0;
  for (let k = 0; k < D.length; k++) if (total[N][k] + eb * Math.abs(D[k]) < total[N][j] + eb * Math.abs(D[j])) j = k;
  const out: P[] = [];
  for (let i = N; i >= 0; i--) { out.push(point(u0 + i * 0.25, D[j])); j = from[i][j]; }
  return out.reverse();
}
