import { describe, it, expect, beforeAll } from 'vitest';
import { Profile } from '../src/lab/course';
import { buildHill } from '../src/world/places/hill';
import { createPhysics, castDown, type Physics } from '../src/world/physics';
import { TrailPath, inZone, inZoneHeading, trailPoint, trailY, type Trail, type TrailZone } from '../src/world/trail';

// A left 180 degree switchback: 5 m straight, an arc of radius 4, 5 m straight back. Left of +x is -z, so the arc's
// middle is at (5 + 4, -4) and the way back runs along z = -8.
const R = 4, ARC = Math.PI * R;
const bend = (): Trail => ({ id: 'bend', path: new TrailPath(0, 0, 0).straight(5).arc(R, 180).straight(5), profile: new Profile().flat(5 + ARC + 5), width: 3, y0: 0 });

describe('nearest and inZone on an arc', () => {
  const t = bend(), mid = 5 + ARC / 2;
  it('nearest on the bend: outside is right (+), inside is left (-), and u is the arc length to the middle', () => {
    const out = t.path.nearest(5 + R + 1, -R), inn = t.path.nearest(5 + R - 1, -R);
    expect(out.dist).toBeCloseTo(1, 1);
    expect(out.off).toBeCloseTo(1, 1);
    expect(out.u).toBeCloseTo(mid, 1);
    expect(inn.dist).toBeCloseTo(1, 1);
    expect(inn.off).toBeCloseTo(-1, 1);
    expect(inn.u).toBeCloseTo(mid, 1);
  });
  it('nearest at the centre of the bend is a radius away from every point of the arc', () => {
    const n = t.path.nearest(5, -R);
    expect(n.dist).toBeCloseTo(R, 1);
    expect(n.off).toBeCloseTo(-R, 1); // all of it on the left (inside)
  });
  it('the two legs of a hairpin are each nearest to their own side', () => {
    const first = t.path.nearest(2, 0.3), back = t.path.nearest(2, -2 * R - 0.3);
    expect(first.u).toBeCloseTo(2, 1);
    expect(back.u).toBeCloseTo(5 + ARC + 3, 1); // back along the far leg: 3 m after the arc
    expect(back.dist).toBeCloseTo(0.3, 1);
  });
  it('a zone on the bend holds the arc, within its width, and nothing beyond', () => {
    const z: TrailZone = { trail: t, u0: 5, u1: 5 + ARC, off0: -1.5, off1: 1.5 };
    expect(inZone(z, 5 + R, -R)).toBe(true);
    expect(inZone(z, 5 + R + 1.4, -R)).toBe(true);
    expect(inZone(z, 5 + R + 1.7, -R)).toBe(false); // past the outside edge
    expect(inZone(z, 5 + R - 1.7, -R)).toBe(false); // past the inside edge
    expect(inZone(z, 2, 0)).toBe(false); // the straight before it
    expect(inZone(z, 2, -2 * R)).toBe(false); // the straight after it
  });
  it('a one-way zone on the bend counts only a bike heading round it', () => {
    const z: TrailZone = { trail: t, u0: 5, u1: 5 + ARC, up: 1 };
    // a bike heading the way the trail runs there (its own yaw) is in the zone; one turned right round is not
    const along = t.path.at(5 + ARC / 2).yaw;
    expect(inZoneHeading(z, 5 + R, -R, along)).toBe(true);
    expect(inZoneHeading(z, 5 + R, -R, along + Math.PI)).toBe(false);
    expect(inZoneHeading({ ...z, up: -1 }, 5 + R, -R, along + Math.PI)).toBe(true);
  });
});

describe("Hairpin Hollow's top platform", () => {
  const hill = buildHill(), top = hill.trails.hairpinTop;
  let phys: Physics;
  beforeAll(async () => { phys = await createPhysics(hill.world); });
  // the footprint is the trail's whole rectangle: its length along, and its width across (from the left edge to the right)
  it('is dirt at one height across its whole footprint', () => {
    const half = top.width / 2, h = trailY(top, 0), len = top.path.length;
    let checked = 0;
    for (let u = 0.3; u < len - 0.2; u += 0.5) for (let off = -half + 0.2; off <= half - 0.2; off += 0.6) {
      const p = trailPoint(top, u, off), hit = castDown(phys, p.x, p.y + 5, p.z, 20), at = `u ${u.toFixed(1)} off ${off.toFixed(1)}`;
      if (hit?.surface === 'rock') continue; // the clumps of rock round its edge sit on it on purpose
      expect(hit?.surface, at).toBe('dirt');
      expect(Math.abs(hit!.height - h), at).toBeLessThan(0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
    // the old platform's size: 6.55 m long, 6.75 m across (4.5 m to the left of the trail's middle, 2.25 m to the right)
    expect(len).toBeCloseTo(6.55, 1);
    expect(top.width).toBeCloseTo(6.75, 1);
  });
});
