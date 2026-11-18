import { describe, it, expect } from 'vitest';
import { Profile } from '../src/lab/course';
import { TrailPath, trailY, type Trail } from '../src/world/trail';
import { buildTerrain, type HillShape } from '../src/world/terrain';

// a 30 m cone, 4 m tall at the peak
const cone: HillShape = { height: (x, z) => Math.max(0, 4 * (1 - Math.hypot(x, z) / 30)) };
// trails are laid over the hill, so their profile follows what the hill would be along the path
const laid = (path: TrailPath): Profile => {
  const prof = new Profile();
  for (let u = 1; u <= path.length; u++) { const p = path.at(u); prof.pts.push([u, cone.height(p.x, p.z)]); }
  prof.pts[0] = [0, cone.height(path.at(0).x, path.at(0).z)];
  return prof;
};
const climbPath = new TrailPath(-27, -4, 0).straight(10).arc(30, 25).straight(6);
// a trail round the hill at 18 m from the peak, along a contour
const crossPath = new TrailPath(18, 0, -Math.PI / 2).arc(18, -150);
const climb: Trail = { id: 'climb', width: 3, y0: 0, path: climbPath, profile: laid(climbPath) };
const cross: Trail = { id: 'cross', width: 2.4, y0: 0, path: crossPath, profile: laid(crossPath) };
const trails = [climb, cross];
const extent = { x0: -45, x1: 45, z0: -45, z1: 45 };
const terrain = buildTerrain(trails, cone, extent);

// a small seeded random so the tests are stable
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

describe('hill surface', () => {
  it('stays under the trail across its whole width', () => {
    const r = rng(1);
    for (const t of trails) {
      for (let i = 0; i < 500; i++) {
        // stay a couple of metres off the ends: the bench past an end sits at the end's height, which is a cap, not a trail
        const u = 2.5 + r() * (t.path.length - 5), off = (r() - 0.5) * t.width, p = t.path.at(u);
        const x = p.x + off * Math.sin(p.yaw), z = p.z + off * Math.cos(p.yaw);
        const n = t.path.nearest(x, z);
        expect(terrain.heightAt(x, z)).toBeLessThanOrEqual(trailY(t, n.u) - 0.02);
      }
    }
  });
  it('meets the trail edge at a bench just outside it', () => {
    const r = rng(2);
    for (const t of trails) {
      for (let i = 0; i < 100; i++) {
        const u = 1 + r() * (t.path.length - 2), p = t.path.at(u), off = (r() < 0.5 ? -1 : 1) * (t.width / 2 + 1.0);
        const x = p.x + off * Math.sin(p.yaw), z = p.z + off * Math.cos(p.yaw);
        const n = t.path.nearest(x, z);
        // skip spots where the other trail is the closer one
        if (trails.some((o) => o !== t && o.path.nearest(x, z).dist < o.width / 2 + 6)) continue;
        // 0.1 rather than 0.06: the bench also dips with the profile's own curvature (sag over a 1.5-cell window), which is
        // what keeps kickers and landings from bumping up through the ribbon
        expect(Math.abs(terrain.heightAt(x, z) - trailY(t, n.u))).toBeLessThan(0.1);
      }
    }
  });
  it('is the natural hill 20 m from any trail', () => {
    let checked = 0;
    // at grid vertices, where the surface is the shape itself (between them it is the triangles' flat approximation)
    for (let x = -45; x <= 45; x += 1.5) for (let z = -45; z <= 45; z += 1.5) {
      if (trails.some((t) => t.path.nearest(x, z).dist < 20)) continue;
      expect(terrain.heightAt(x, z)).toBeCloseTo(cone.height(x, z), 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
  it('has no holes and no bad numbers', () => {
    const geo = terrain.mesh.geometry, nx = Math.ceil(90 / 1.5), nz = Math.ceil(90 / 1.5);
    expect(geo.index!.count / 3).toBe(2 * nx * nz);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
    expect(terrain.mesh.userData.collide).toBe('grass');
  });
  it('heightAt matches the mesh at a vertex', () => {
    const pos = terrain.mesh.geometry.getAttribute('position');
    for (const i of [0, 777, 2500, pos.count - 1]) expect(terrain.heightAt(pos.getX(i), pos.getZ(i))).toBeCloseTo(pos.getY(i), 4);
  });
  it('builds a 300 m extent with four trails quickly enough', () => {
    const four = [climb, cross, { ...cross, id: 'c2', path: new TrailPath(-100, 60, 0).straight(150).arc(20, 120).straight(60) }, { ...climb, id: 'c3', path: new TrailPath(50, -80, 2).straight(120) }];
    const t0 = performance.now();
    const big = buildTerrain(four, cone, { x0: -150, x1: 150, z0: -150, z1: 150 });
    const ms = performance.now() - t0;
    console.log(`buildTerrain 300x300 m, 4 trails: ${ms.toFixed(0)} ms`);
    expect(big.mesh.geometry.index!.count / 3).toBe(2 * 200 * 200);
    expect(ms).toBeLessThan(3000);
  });
  it('stays under the ribbon around vertical steps up and down', () => {
    const prof = new Profile().flat(10);
    prof.pts.push([prof.u, prof.h + 0.3]); // a 0.3 m ledge up
    prof.flat(12);
    prof.pts.push([prof.u, prof.h - 0.3]); // and a drop back down
    prof.flat(10);
    const path = new TrailPath(-20, 0, 0).straight(32);
    const stepped: Trail = { id: 'steps', width: 2.4, y0: 1, path, profile: prof };
    const flatHill: HillShape = { height: () => 1.6 }; // above the whole trail, so only the clamp holds it down
    const t = buildTerrain([stepped], flatHill, { x0: -30, x1: 30, z0: -15, z1: 15 });
    const r = rng(3);
    for (const stepU of [10, 22]) {
      for (let i = 0; i < 400; i++) {
        const u = stepU + (r() - 0.5) * 6, x = -20 + u, z = (r() - 0.5) * stepped.width;
        // at a step the ribbon is its lower side
        const low = Math.min(trailY(stepped, u - 1e-6), trailY(stepped, u + 1e-6));
        expect(t.heightAt(x, z)).toBeLessThanOrEqual(low - 0.02);
      }
    }
  });
  it('stays under the ribbon over a tight concave dip (a landing or kick bottom)', () => {
    const prof = new Profile().flat(8).slopeTo(-30, 0.2);
    const u0 = prof.u;
    prof.concave(-30, 30, 3).flat(8); // a dip with a 3 m radius: the chord between grid vertices sags well past 0.03 m
    const u1 = u0 + 3 * (Math.PI * 60) / 180;
    const path = new TrailPath(-15, 0, 0).straight(prof.u);
    const dip: Trail = { id: 'dip', width: 2.4, y0: 0, path, profile: prof };
    const hill: HillShape = { height: () => 5 }; // high above the trail, so only the clamp holds the ground down
    const t = buildTerrain([dip], hill, { x0: -30, x1: 30, z0: -15, z1: 15 });
    const r = rng(4);
    for (let i = 0; i < 600; i++) {
      const u = u0 - 1 + r() * (u1 - u0 + 2), x = -15 + u, z = (r() - 0.5) * dip.width;
      expect(t.heightAt(x, z)).toBeLessThanOrEqual(trailY(dip, u) - 0.02);
    }
  });
  it('stays under the ribbon everywhere along a jump line laid slantwise across the grid (checked closely)', () => {
    // Goat Ladder's descent: tables with tight landings, then a convex rollover into a landing, on a path that crosses
    // the grid at an angle, so the triangles' diagonals cut across the curves every which way
    const prof = new Profile();
    prof.pts[0] = [0, 6];
    prof.flat(2).kick(0.7, 26).flat(3.6).landing(24, 3).flat(2).kick(1.2, 28).flat(7.5).landing(26, 4).flat(2);
    prof.convex(0, -16, 6).landing(16, 8).flat(4);
    const path = new TrailPath(-25, -8, -0.35).straight(prof.u);
    const line: Trail = { id: 'line', width: 3, y0: 0.02, path, profile: prof };
    const t = buildTerrain([line], { height: () => 12 }, { x0: -30, x1: 30, z0: -15, z1: 15 }); // the clamp holds it down
    let worst = -Infinity, at = '';
    for (let u = 0.5; u <= path.length - 0.5; u += 0.1) for (let off = -1.5; off <= 1.5001; off += 0.1) {
      const p = path.at(u), x = p.x - off * Math.sin(p.yaw), z = p.z - off * Math.cos(p.yaw);
      const over = t.heightAt(x, z) - (trailY(line, u) - 0.02);
      if (over > worst) { worst = over; at = `u ${u.toFixed(1)} off ${off.toFixed(1)}`; }
    }
    expect(worst, at).toBeLessThanOrEqual(0);
  });
});
