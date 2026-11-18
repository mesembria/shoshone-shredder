import { describe, it, expect, beforeAll } from 'vitest';
import { buildHill } from '../src/world/places/hill';
import { createPhysics, castDown, type Physics } from '../src/world/physics';
import { runEvent } from '../src/game/spots';
import { hairpin, hairpinLegs, HAIRPIN } from '../src/world/trails/hairpin';
import { boulderDash } from '../src/world/trails/boulderDash';
import { heightAt } from '../src/lab/course';
import { trailPoint, trailY, type Trail } from '../src/world/trail';

const hill = buildHill();
const T = hill.trails;
let phys: Physics;
beforeAll(async () => { phys = await createPhysics(hill.world); });

// which trail each station stands on, and whether it faces back down it
const ON: Record<string, [string, boolean]> = {
  Trailhead: ['goatUp', false], Climb: ['goatUp', false], Summit: ['goatDown', false], Switchbacks: ['hairpin', false],
  'Switchbacks top': ['hairpin', true], 'Rock chute': ['boulderDash', false], Shoulder: ['connector', false], Hilltop: ['connector', false],
};

describe('the whole Shredder Hills hill', () => {
  it('has every hill station', () => {
    expect(Object.keys(hill.stations)).toEqual(['Trailhead', 'Climb', 'Summit', 'Switchbacks', 'Switchbacks top', 'Rock chute', 'Shoulder', 'Hilltop']);
  });

  it('puts the summit at 20 m, Goat Ladder\'s top at 12.1 m and Hairpin\'s top at 10.7 m', () => {
    expect(hill.stations['Rock chute'].pos.y).toBeCloseTo(20, 0);
    expect(hill.stations.Summit.pos.y).toBeCloseTo(12.1, 0);
    expect(hill.stations['Switchbacks top'].pos.y).toBeCloseTo(10.7, 0);
    // the connector really links the shoulder to the summit
    const c = T.connector, start = c.path.at(0), end = c.path.at(c.path.length);
    expect(T.goatDown.path.nearest(start.x, start.z).dist).toBeLessThan(0.01);
    expect(T.boulderDash.path.nearest(end.x, end.z).dist).toBeLessThan(0.01);
  });

  it('gives every station a place to stand: on the ground, facing along its trail', () => {
    for (const [name, s] of Object.entries(hill.stations)) {
      const hit = castDown(phys, s.pos.x, s.pos.y + 3, s.pos.z, 10);
      expect(hit, name).not.toBeNull();
      expect(Math.abs(hit!.height - s.pos.y), name).toBeLessThan(0.1);
      const [id, back] = ON[name], t = T[id], n = t.path.nearest(s.pos.x, s.pos.z);
      expect(Math.cos(s.yaw - t.path.at(n.u).yaw - (back ? Math.PI : 0)), name).toBeGreaterThan(0.95);
    }
  });

  it('crosses each run\'s lines forward and in order, riding its trail', () => {
    // walk a trail's path every 0.2 m, from u0 to u1 (backwards when u1 < u0), and collect the run's events
    const walk = (id: string, legs: [Trail, number, number][]) => {
      const out: string[] = [];
      let prev: { x: number; y: number; z: number; grounded: boolean } | null = null;
      for (const [t, u0, u1] of legs) {
        const n = Math.ceil(Math.abs(u1 - u0) / 0.2);
        for (let i = 0; i <= n; i++) {
          const p = t.path.at(u0 + ((u1 - u0) * i) / n), cur = { x: p.x, y: 0, z: p.z, grounded: true };
          if (prev) { const e = runEvent(id, prev, cur, hill.runs); if (e) out.push(e); }
          prev = cur;
        }
      }
      return out;
    };
    const up = T.goatUp, down = T.goatDown, hp = T.hairpin, bd = T.boulderDash, L = (t: Trail) => t.path.length;
    expect(walk('goatUp', [[up, 0, L(up)]])).toEqual(['start', 'finish']);
    expect(walk('goatDown', [[down, 0, L(down)]])).toEqual(['start', 'finish']);
    expect(walk('goatBoth', [[up, 0, L(up)], [down, 0, L(down)]])).toEqual(['start', 'via', 'finish']);
    expect(walk('hairpinUp', [[hp, 0, L(hp)]])).toEqual(['start', 'finish']);
    expect(walk('hairpinDown', [[hp, L(hp), 0]])).toEqual(['start', 'finish']);
    expect(walk('hairpinBoth', [[hp, 0, L(hp)], [hp, L(hp), 0]])).toEqual(['start', 'via', 'finish']);
    expect(walk('boulderDash', [[bd, 0, L(bd)]])).toEqual(['start', 'finish']);
  });

  it('has ground under every point of the hill', () => {
    const e = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    // the terrain mesh's own extent
    const pos = (hill.world.children[0] as any).geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { e.x0 = Math.min(e.x0, pos.getX(i)); e.x1 = Math.max(e.x1, pos.getX(i)); e.z0 = Math.min(e.z0, pos.getZ(i)); e.z1 = Math.max(e.z1, pos.getZ(i)); }
    let n = 0;
    for (let x = e.x0; x <= e.x1; x += 3) for (let z = e.z0; z <= e.z1; z += 3) {
      // the hill itself (or something standing on it), not the flat that sits under everything far below
      const hit = castDown(phys, x, 60, z, 80), at = `${x.toFixed(0)}, ${z.toFixed(0)}`;
      expect(hit, at).not.toBeNull();
      expect(hit!.height, at).toBeGreaterThanOrEqual(hill.ground!(x, z) - 0.05);
      n++;
    }
    expect(n).toBeGreaterThan(4000);
    // and the hill comes down to the flat at its edge, so there's no step where the terrain ends
    for (let x = e.x0; x <= e.x1; x += 3) for (const z of [e.z0, e.z1]) expect(hill.ground!(x, z)).toBeLessThan(0.05);
    for (let z = e.z0; z <= e.z1; z += 3) for (const x of [e.x0, e.x1]) expect(hill.ground!(x, z)).toBeLessThan(0.05);
  });

  it('keeps the ground beside every trail at the trail\'s height', () => {
    // Half a metre and a metre and a half past each edge, the ground sits at the trail's height. The terrain's bench
    // follows the lowest point of the profile over a 2.25 m window and its triangles are 1.5 m across, so "the trail's
    // height" is anywhere from the lowest point within 3.75 m along the trail up to the height right there; the bench
    // ends 1.5 m out, where a triangle already leans up to 3/8 of the way into the blend back to the hillside (and half a
    // metre out a triangle still reaches about a quarter of the way in: up to 0.35 m on the steepest faces).
    // Where another trail's influence (its bench plus the blend, 5.5 m past its edge, and a triangle more) reaches
    // and that trail is lower, its bench legitimately wins: those spots are exempt, and listed.
    const trails = Object.values(T), TOL = { 0.5: 0.35, 1.5: 0.75 } as const, exempt = new Set<string>();
    let checked = 0;
    for (const t of trails) for (let u = 0.5; u < t.path.length - 0.5; u += 0.5) {
      let lo = Infinity;
      for (let v = Math.max(0, u - 3.75); v <= Math.min(t.path.length, u + 3.75); v += 0.1) lo = Math.min(lo, trailY(t, v));
      for (const side of [-1, 1]) for (const k of [0.5, 1.5] as const) {
        const p = trailPoint(t, u, side * (t.width / 2 + k)), g = hill.ground!(p.x, p.z), at = `${t.id} u ${u} ${side > 0 ? 'right' : 'left'} +${k}`;
        const lower = trails.find((o) => {
          if (o === t) return false;
          const n = o.path.nearest(p.x, p.z);
          return n.dist < o.width / 2 + 7 && trailY(o, n.u) < lo - TOL[k];
        });
        if (lower) { exempt.add(`${t.id} beside ${lower.id}`); continue; }
        expect(g, at).toBeGreaterThan(lo - TOL[k]);
        expect(g, at).toBeLessThan(trailY(t, u) + TOL[k]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
    // only Goat Ladder's climb, where its descent runs lower past the outside of switchback 2 and below leg 3
    expect([...exempt]).toEqual(['goatUp beside goatDown']);
  });

  it('takes a spur from Hairpin Hollow\'s top to the connector, through a gap in the platform\'s rocks', () => {
    const s = T.spur, a = s.path.at(0), b = s.path.at(s.path.length);
    expect(T.hairpinTop.path.nearest(a.x, a.z).dist).toBeLessThan(0.01);
    expect(T.connector.path.nearest(b.x, b.z).dist).toBeLessThan(0.01);
    expect(trailY(s, 0)).toBeCloseTo(trailY(T.hairpinTop, 0), 6);
    expect(trailY(s, s.path.length)).toBeCloseTo(trailY(T.connector, T.connector.path.nearest(b.x, b.z).u), 6);
    // dirt, not rock, the whole way out of the platform (across the spur, edge to edge)
    for (let u = 0; u <= 10; u += 0.25) for (const off of [-1.2, 0, 1.2]) {
      const p = trailPoint(s, u, off), hit = castDown(phys, p.x, p.y + 5, p.z, 10);
      expect(hit?.surface, `spur u ${u} off ${off}`).toBe('dirt');
    }
  });

  it('keeps every trail bottom on the trailhead lot', () => {
    const lot = (x: number, z: number) => castDown(phys, x, 5, z, 10);
    for (const [t, u] of [[T.goatUp, 0], [T.goatDown, T.goatDown.path.length], [T.hairpin, 0], [T.boulderDash, T.boulderDash.path.length]] as const) {
      const p = t.path.at(u), dir = u === 0 ? -1 : 1;
      const x = p.x + dir * 1.5 * Math.cos(p.yaw), z = p.z - dir * 1.5 * Math.sin(p.yaw); // a step off the trail's end
      expect(lot(x, z)?.surface, t.id).toBe('ground');
      expect(lot(x, z)!.height, t.id).toBeLessThan(0.05);
    }
  });
});

describe('Hairpin Hollow and Boulder Dash on the hill', () => {
  const hp = hairpin(), bd = boulderDash();
  it('keeps Hairpin\'s switchbacks half circles of radius 2, each with its boulder in the middle', () => {
    const arcs = hp.trail.path.pieces.filter((p) => p.radius !== undefined && Math.abs(p.turnDeg!) === 180);
    expect(arcs.length).toBe(4);
    for (const a of arcs) expect(a.radius).toBe(HAIRPIN.SR);
    for (const a of hp.trail.path.pieces) if (a.radius !== undefined && a.radius !== HAIRPIN.SR) expect(a.radius).toBeGreaterThanOrEqual(25);
    hp.marks.switchbacks.forEach((u, i) => {
      // the middle of the turn: R to the inside of where it starts (left turns first)
      const p = hp.trail.path.at(u), side = i % 2 ? 1 : -1, cx = p.x + side * HAIRPIN.SR * Math.sin(p.yaw), cz = p.z + side * HAIRPIN.SR * Math.cos(p.yaw);
      const hit = castDown(phys, cx, 30, cz, 40);
      expect(hit?.surface, `switchback ${i + 1}`).toBe('rock');
    });
  });
  it('keeps the old profiles along the trail', () => {
    const { legs } = hairpinLegs();
    legs.forEach((p, i) => {
      const u0 = hp.marks.legs[i][0];
      for (let u = 0; u <= HAIRPIN.leg; u += 0.5) expect(heightAt(hp.trail.profile, u0 + u)).toBeCloseTo(heightAt(p, u), 9);
    });
    expect(heightAt(bd.trail.profile, 0)).toBe(20);
    expect(bd.marks.finishU).toBeCloseTo(130.7, 1);
  });
  it('rides on dirt at the trail height along Hairpin Hollow, Boulder Dash, the connector and the spur', () => {
    const rocks = [...hp.features.rocks, ...bd.features.rocks];
    for (const t of [T.hairpin, T.boulderDash, T.connector, T.spur]) for (const off of [0, -t.width / 2 + 0.1, t.width / 2 - 0.1]) {
      let checked = 0;
      for (let i = 0; i < 300; i++) {
        const u = ((i + 0.5) / 300) * t.path.length;
        if (rocks.some((r) => r.trail.id === t.id && Math.abs(r.u - u) < r.r + 0.3 && Math.abs(r.off - off) < r.r + 0.3)) continue;
        const p = t.path.at(u), y = t.y0 + heightAt(t.profile, u), x = p.x + off * Math.sin(p.yaw), z = p.z + off * Math.cos(p.yaw);
        const hit = castDown(phys, x, y + 5, z, 20), at = `${t.id} u ${u.toFixed(1)} off ${off}`;
        expect(hit?.surface, at).toBe('dirt');
        expect(Math.abs(hit!.height - y), at).toBeLessThan(0.05);
        checked++;
      }
      expect(checked).toBeGreaterThan(250);
    }
  });
});
