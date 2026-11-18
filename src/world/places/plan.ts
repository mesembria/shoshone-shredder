// The scenery plan a place hands to the look (src/look/scenery.ts): where the dressing may go. The look never reads the
// course's meshes; the place says what must stay clear (trail edges, lips, stations, rings, feature footprints) and the
// plan keeps one coarse grid of "metres to the nearest of them", so asking is a lookup.
import type { SceneryPlan } from '../../lab/course';
import type { Extent } from '../terrain';
import { rng } from '../rng';

export type { Extent };
// segments (x0, z0, x1, z1, half-width), rectangles (x0, z0, x1, z1) and discs (x, z, radius): each must stay clear
export interface Blockers { segs: number[][]; rects: number[][]; discs: number[][] }

export const CAP = 14; // clearance is only told up to here
export const MARGIN = 30; // the boundary stands this far outside the extent

// a polyline's segments, as blockers with the same half-width (points every metre or so are plenty)
export function polyline(pts: { x: number; z: number }[], half: number): number[][] {
  const out: number[][] = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z, half]);
  return out;
}

export function makePlan(o: {
  seed: number; extent: Extent; ground: (x: number, z: number) => number; blockers: Blockers;
  home: { x: number; z: number }; insideGroves?: number; // the share of far-grove tries that are kept inside the extent
}): SceneryPlan {
  const { extent: e, blockers: b } = o;
  const W = Math.ceil(e.x1 - e.x0), H = Math.ceil(e.z1 - e.z0), grid = new Float32Array(W * H).fill(CAP);
  const stamp = (x0: number, z0: number, x1: number, z1: number, dist: (x: number, z: number) => number) => {
    const i0 = Math.max(0, Math.floor(x0 - CAP - e.x0)), i1 = Math.min(W - 1, Math.ceil(x1 + CAP - e.x0));
    const j0 = Math.max(0, Math.floor(z0 - CAP - e.z0)), j1 = Math.min(H - 1, Math.ceil(z1 + CAP - e.z0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = dist(e.x0 + i + 0.5, e.z0 + j + 0.5);
      if (d < grid[j * W + i]) grid[j * W + i] = d;
    }
  };
  for (const [ax, az, bx, bz, r] of b.segs) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    stamp(Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, (x, z) => {
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
      return Math.hypot(x - ax - t * dx, z - az - t * dz) - r;
    });
  }
  for (const [x0, z0, x1, z1] of b.rects) stamp(x0, z0, x1, z1, (x, z) => Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1)));
  for (const [cx, cz, r] of b.discs) stamp(cx - r, cz - r, cx + r, cz + r, (x, z) => Math.hypot(x - cx, z - cz) - r);

  const clearance = (x: number, z: number): number => {
    const i = Math.floor(x - e.x0), j = Math.floor(z - e.z0);
    if (i < 0 || j < 0 || i >= W || j >= H) return CAP;
    return Math.max(0, grid[j * W + i]);
  };
  const bound = { x0: e.x0 - MARGIN, x1: e.x1 + MARGIN, z0: e.z0 - MARGIN, z1: e.z1 + MARGIN };
  // the grid covers the extent only: every trail, feature and ring lies inside it, so between the extent and the boundary
  // clearance is CAP (nothing there to keep clear of)
  const inExtent = (x: number, z: number) => x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1;
  const ground = (x: number, z: number) => (inExtent(x, z) ? o.ground(x, z) : 0);
  const r = rng(o.seed);

  // prairie dog towns: three, on open, gentle ground 25 to 80 m from where the rider starts, 30 m apart
  const towns: SceneryPlan['towns'] = [];
  const cands: { x: number; z: number; d: number }[] = [];
  for (let k = 0; k < 600; k++) {
    const x = e.x0 + r() * (e.x1 - e.x0), z = e.z0 + r() * (e.z1 - e.z0), d = Math.hypot(x - o.home.x, z - o.home.z);
    if (d < 25 || d > 80 || clearance(x, z) < 8) continue;
    const g = o.ground(x, z);
    if ([[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dz]) => Math.abs(o.ground(x + dx, z + dz) - g) > 0.7)) continue;
    cands.push({ x, z, d });
  }
  for (const c of cands) if (towns.length < 3 && towns.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > 30)) towns.push({ x: c.x, z: c.z });

  // pine groves: a few single trees and pairs on open ground inside the extent, bigger clumps on the hills around it
  const groves: SceneryPlan['groves'] = [], keep = o.insideGroves ?? 0.3, m = 420;
  for (let k = 0; k < 320; k++) {
    const x = e.x0 - m + r() * (e.x1 - e.x0 + 2 * m), z = e.z0 - m + r() * (e.z1 - e.z0 + 2 * m);
    const inside = x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1;
    const skip = r() > keep, n = inside ? 1 + Math.floor(r() * 3) : 3 + Math.floor(r() * 6);
    if (inside && (skip || clearance(x, z) < 8)) continue;
    groves.push({ x, z, r: inside ? 7 : 15, n });
  }
  return { seed: o.seed, extent: e, bound, clearance, towns, groves, ground };
}
