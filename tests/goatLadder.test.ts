import { describe, it, expect } from 'vitest';
import { goatLadder } from '../src/world/trails/goatLadder';
import { buildHill } from '../src/world/places/hill';
import { createPhysics, castDown } from '../src/world/physics';
import { trailPoint, trailSeed, trailY, type Trail } from '../src/world/trail';

const g = goatLadder();

describe('Goat Ladder on curved trails', () => {
  it('climbs to the shoulder, and the descent starts at that height', () => {
    expect(g.up.profile.h).toBeCloseTo(12.1, 0);
    expect(trailY(g.down, 0)).toBeCloseTo(trailY(g.up, g.up.path.length), 6);
  });
  it('has exactly two switchbacks as tight as the old pads, and only gentle bends besides', () => {
    const arcs = g.up.path.pieces.filter((p) => p.radius !== undefined);
    expect(arcs.filter((a) => a.radius === 3.5).length).toBe(2);
    for (const t of [g.up, g.down]) for (const a of t.path.pieces) if (a.radius !== undefined && a.radius !== 3.5) expect(a.radius).toBeGreaterThanOrEqual(25);
  });
});

describe('the hill with Goat Ladder', () => {
  const hill = buildHill();
  it('is its own place, starting at the trailhead', () => {
    expect(hill.place).toBe('shredderHills');
    expect(hill.home).toBe('Trailhead');
    for (const s of ['Trailhead', 'Climb', 'Summit']) expect(hill.stations[s]).toBeDefined();
  });
  it('has as many ledges, gravel patches and descent jumps as the old climb', () => {
    // counts on Goat Ladder's hillside in the deleted old park, frozen when it was deleted (Task 9)
    const ledges = 6, gravel = 3, jumps = 2;
    expect(hill.climb.ledges.length).toBe(ledges);
    // the hill's other trails have gravel too: count Goat Ladder's
    expect(hill.climb.loose.filter((z) => 'trail' in z && z.trail.id.startsWith('goat')).length).toBe(gravel);
    const down = hill.trails.goatDown;
    expect(hill.lines.filter((l) => down.path.nearest(l.lip.x, l.lip.z).dist < 0.5).length).toBe(jumps);
  });
  it('rides on dirt at the trail height all along both trails: no terrain pokes through', async () => {
    const phys = await createPhysics(hill.world);
    // rocks and the log sit on the trail on purpose: skip the few samples right under them
    const covered = (t: Trail, u: number, off: number) =>
      g.features.rocks.some((r) => r.trail.id === t.id && Math.abs(r.u - u) < r.r + 0.3 && Math.abs(r.off - off) < r.r + 0.3) ||
      g.features.slabs.some((s) => s.trail.id === t.id && Math.abs(s.u - u) < s.len / 2 + 0.1 && Math.abs(s.off - off) < s.wid / 2 + 0.1) ||
      g.features.logs.some((l) => l.trail.id === t.id && Math.abs(l.u - u) < 0.6);
    // the centreline and close to both edges (leg 3 and the descent run near each other, with land between)
    for (const off of [0, -1.4, 1.4]) for (const t of [hill.trails.goatUp, hill.trails.goatDown]) {
      let checked = 0;
      for (let i = 0; i < 200; i++) {
        const u = ((i + 0.5) / 200) * t.path.length;
        if (covered(t, u, off)) continue;
        const p = trailPoint(t, u, off), hit = castDown(phys, p.x, p.y + 5, p.z, 20), at = `${t.id} at u ${u.toFixed(1)} off ${off}`;
        expect(hit?.surface, at).toBe('dirt');
        expect(Math.abs(hit!.height - trailY(t, u)), at).toBeLessThan(0.05);
        checked++;
      }
      expect(checked).toBeGreaterThan(150); // the rock gardens and slabs cover a few metres
    }
  });
  it("gives a trail's rocks the same shapes wherever the trail is laid", () => {
    const moved: Trail = { ...g.up, id: 'goatUp' }, other: Trail = { ...g.up, id: 'somewhereElse' };
    for (const r of g.features.rocks.slice(0, 5)) {
      expect(trailSeed(moved, r.u, r.off)).toBe(trailSeed(r.trail, r.u, r.off));
      expect(trailSeed(r.trail, r.u, r.off)).toBeGreaterThanOrEqual(0);
      expect(trailSeed(r.trail, r.u, r.off)).toBeLessThan(1);
    }
    const r = g.features.rocks[0];
    expect(trailSeed(other, r.u, r.off)).not.toBe(trailSeed(r.trail, r.u, r.off));
  });
});
