import { describe, it, expect } from 'vitest';
import { Profile } from '../src/lab/course';
import type { Gate } from '../src/lab/course';
import { runEvent } from '../src/game/spots';
import { TrailPath, trailY, trailRibbon, inZone, inZoneHeading, gateAcross, type Trail, type TrailZone } from '../src/world/trail';

describe('trail tool', () => {
  it('a straight path runs along its yaw', () => {
    const p = new TrailPath(0, 0, 0).straight(10);
    expect(p.length).toBeCloseTo(10);
    expect(p.at(10)).toMatchObject({ x: expect.closeTo(10, 3), z: expect.closeTo(0, 3) });
  });
  it('a left 180° arc of radius 3.5 ends 7 m to the left, facing back', () => {
    const p = new TrailPath(0, 0, 0).straight(5).arc(3.5, 180);
    const end = p.at(p.length);
    expect(p.length).toBeCloseTo(5 + Math.PI * 3.5, 2);
    expect(end.x).toBeCloseTo(5, 2);
    expect(end.z).toBeCloseTo(-7, 2); // left of +x is -z
    expect(Math.cos(end.yaw)).toBeCloseTo(-1, 3);
  });
  it('nearest finds distance along and signed offset (right is +)', () => {
    const p = new TrailPath(0, 0, 0).straight(20);
    expect(p.nearest(8, 1.5)).toMatchObject({ u: expect.closeTo(8, 2), off: expect.closeTo(1.5, 2) });
    expect(p.nearest(8, -1).off).toBeCloseTo(-1, 2);
  });
  it('trailY follows the profile, steps included', () => {
    const prof = new Profile(); prof.flat(5); prof.pts.push([5, 0.3]); prof.flat(5);
    const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).straight(10), profile: prof, width: 3, y0: 2 };
    expect(trailY(t, 2)).toBeCloseTo(2);
    expect(trailY(t, 7)).toBeCloseTo(2.3);
  });
  it('a trail zone covers its stretch and width only', () => {
    const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).straight(30), profile: new Profile().flat(30), width: 3, y0: 0 };
    const z: TrailZone = { trail: t, u0: 10, u1: 20, off0: -1.8, off1: 1.8 };
    expect(inZone(z, 15, 1)).toBe(true);
    expect(inZone(z, 25, 0)).toBe(false);
    expect(inZone(z, 15, 3)).toBe(false);
    expect(inZone({ x0: 0, x1: 1, z0: 0, z1: 1 }, 0.5, 0.5)).toBe(true);
  });
  it('gateAcross on an arc counts forward crossings only', () => {
    const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).straight(5).arc(4, 90).straight(5), profile: new Profile().flat(20), width: 3, y0: 0 };
    const u = 5 + (Math.PI * 4) / 4; // the end of the bend
    const g: Gate = gateAcross(t, u, 2), before = t.path.at(u - 0.3), after = t.path.at(u + 0.3);
    const runs = { x: { start: g, finish: g } };
    expect(runEvent('x', { x: before.x, y: 0, z: before.z, grounded: true }, { x: after.x, y: 0, z: after.z, grounded: true }, runs)).toBe('start');
    expect(runEvent('x', { x: after.x, y: 0, z: after.z, grounded: true }, { x: before.x, y: 0, z: before.z, grounded: true }, runs)).toBeNull();
  });
  it('the ribbon spans the width at the profile height', () => {
    const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).arc(6, 90), profile: new Profile().flat(10), width: 3, y0: 1 };
    const g = trailRibbon(t, { skirt: 0 }); g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(1, 2);
    expect(g.boundingBox!.min.y).toBeCloseTo(1, 2);
  });
  it('a zone with a way up counts only for a rider heading that way, round a bend too', () => {
    // straight east 10 m, then a half turn left on a circle of 3: the far leg runs back west
    const path = new TrailPath(0, 0, 0).straight(10).arc(3, 180).straight(10);
    const trail: Trail = { id: 't', path, profile: new Profile(), width: 2, y0: 0 };
    const up: TrailZone = { trail, u0: 0, u1: path.length, up: 1 }, both: TrailZone = { trail, u0: 0, u1: path.length };
    const E = 0, W = Math.PI;
    expect(inZoneHeading(up, 5, 0, E)).toBe(true); // first leg, riding up the trail
    expect(inZoneHeading(up, 5, 0, W)).toBe(false); // the same spot ridden back down
    expect(inZoneHeading(up, 5, -6, W)).toBe(true); // the far leg runs west, so up the trail is west there
    expect(inZoneHeading(up, 5, -6, E)).toBe(false);
    expect(inZoneHeading({ ...up, up: -1 }, 5, 0, W)).toBe(true);
    expect(inZoneHeading(both, 5, 0, W)).toBe(true); // no way up: both ways
    expect(inZoneHeading(up, 5, 5, E)).toBe(false); // off the trail
  });
});
