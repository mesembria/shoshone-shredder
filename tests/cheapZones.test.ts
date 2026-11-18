// The cheaper zone tests and the binary-search heightAt must agree with the code they replaced, exactly.
import { describe, it, expect } from 'vitest';
import { TrailPath, inZone, type Trail, type TrailZone } from '../src/world/trail';
import { heightAt, type Profile } from '../src/lab/course';
import { rng } from '../src/world/rng';

// the old implementations, copied as they were
function oldNearest(p: any, x: number, z: number): { u: number; off: number; dist: number } {
  let best = { u: 0, off: 0, dist: Infinity };
  for (let i = 0; i < p.xs.length - 1; i++) {
    const dx = p.xs[i + 1] - p.xs[i], dz = p.zs[i + 1] - p.zs[i], len2 = dx * dx + dz * dz;
    const px = x - p.xs[i], pz = z - p.zs[i];
    const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / len2)) : 0;
    const dist = Math.hypot(px - t * dx, pz - t * dz);
    if (dist >= best.dist) continue;
    const len = Math.sqrt(len2);
    best = { u: p.us[i] + t * (p.us[i + 1] - p.us[i]), off: len > 0 ? (px * -dz + pz * dx) / len : 0, dist };
  }
  return best;
}
function oldInZone(z: TrailZone, x: number, zz: number): boolean {
  const { u, off } = oldNearest(z.trail.path, x, zz), half = z.trail.width / 2;
  return u >= z.u0 && u <= z.u1 && off >= (z.off0 ?? -half) && off <= (z.off1 ?? half);
}
function oldHeightAt(prof: Profile, u: number): number {
  const p = prof.pts;
  for (let i = p.length - 1; i > 0; i--) {
    const [u0, h0] = p[i - 1], [u1, h1] = p[i];
    if (u0 <= u) return u1 === u0 ? h1 : h0 + ((h1 - h0) * Math.min(1, (u - u0) / (u1 - u0)));
  }
  return p[0][1];
}

// a winding trail: straights, left and right arcs (one of them more than a half turn), like Hairpin
const winding = () => new TrailPath(-10, 4, 0.3).straight(30).arc(6, 180).straight(12).arc(4, -200).straight(25).arc(9, 95).arc(3, -170).straight(8);
const mkTrail = (id: string, path: TrailPath): Trail => ({ id, path, profile: { pts: [[0, 0], [path.length, 0]], u: path.length } as Profile, width: 1.6, y0: 0 });

describe('nearest and inZone', () => {
  const path = winding(), trail = mkTrail('w', path);
  const zones: TrailZone[] = [
    { trail, u0: 0, u1: path.length },
    { trail, u0: 20, u1: 60 },
    { trail, u0: 40, u1: 90, off0: -0.5, off1: 2.5 },
    { trail, u0: path.length - 3, u1: path.length },
  ];
  it('give the old answers at 40,000 random points, near the trail and far from it', () => {
    const r = rng(5);
    for (let i = 0; i < 40000; i++) {
      // a third of them hug the path (within 4 m of a sample), the rest anywhere in a 300 m square
      let x = (r() - 0.5) * 300, z = (r() - 0.5) * 300;
      if (i % 3 === 0) {
        const a = path.at(r() * path.length), d = (r() - 0.5) * 8;
        x = a.x + d * Math.sin(a.yaw); z = a.z + d * Math.cos(a.yaw);
      }
      const n = path.nearest(x, z), o = oldNearest(path, x, z);
      expect(n).toEqual(o);
      for (const zone of zones) if (inZone(zone, x, z) !== oldInZone(zone, x, z)) throw new Error(`inZone differs at ${x},${z}`);
    }
  });
  it('still answer right after the path grows, and for repeated and alternating points', () => {
    const p = new TrailPath(0, 0, 0).straight(5);
    expect(p.nearest(2, 1)).toEqual(oldNearest(p, 2, 1));
    expect(p.nearest(2, 1)).toEqual(oldNearest(p, 2, 1));
    p.arc(3, 90);
    expect(p.nearest(2, 1)).toEqual(oldNearest(p, 2, 1));
    expect(p.nearest(7, -2)).toEqual(oldNearest(p, 7, -2));
    expect(p.nearest(2, 1)).toEqual(oldNearest(p, 2, 1));
  });
  it('hand back a copy that later calls do not change', () => {
    const a = path.nearest(3, 3), keep = { ...a };
    path.nearest(50, -20);
    expect(a).toEqual(keep);
  });
});

describe('heightAt', () => {
  it('matches the linear scan on a grid, including at and between steps', () => {
    const pts: [number, number][] = [[0, 0], [1, 0.2], [1, 0.9], [2.5, 1], [2.5, 0.4], [2.5, 0.4], [4, 0.1], [4, 1.5], [9, 2]];
    const prof = { pts, u: 9 } as Profile;
    for (let u = -2; u <= 11; u += 0.001) expect(Object.is(heightAt(prof, u), oldHeightAt(prof, u)), `u=${u}`).toBe(true);
    for (const [u] of pts) for (const d of [-1e-9, 0, 1e-9]) expect(Object.is(heightAt(prof, u + d), oldHeightAt(prof, u + d))).toBe(true);
    const one = { pts: [[0, 3]], u: 0 } as Profile;
    expect(heightAt(one, 5)).toBe(oldHeightAt(one, 5));
  });
});
