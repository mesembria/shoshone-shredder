import { describe, it, expect, beforeAll } from 'vitest';
import { buildPark, PLANKS, PUMP_TRACK, LANES, XL_LANE, RHYTHM, SLALOM } from '../src/world/places/park';
import { createPlankWatch, lapEvent } from '../src/game/spots';
import { CHALLENGES } from '../src/game/challenges';
import { castDown, createPhysics, type Physics } from '../src/world/physics';
import { inZone } from '../src/world/trail';

const park = buildPark();
let phys: Physics;
beforeAll(async () => { phys = await createPhysics(park.world); });

const NAMES = ['Park lot', 'Jumps S', 'Jumps M', 'Jumps L', 'Jumps XL', 'Rhythm', 'Pump track', 'Slalom', 'Skinny', 'Start hill'];
const at = (x: number, z: number, y = 0.1, grounded = true) => ({ x, y, z, grounded });

describe('Mesa Jump Park', () => {
  it('is its own place, with the lot as home', () => {
    expect(park.place).toBe('mesaJumpPark');
    expect(park.home).toBe('Park lot');
    expect(park.stations[park.home]).toBeDefined();
  });

  it('has the ten stations', () => {
    expect(Object.keys(park.stations).sort()).toEqual([...NAMES].sort());
  });

  it('gives every station a place to stand', () => {
    for (const [name, s] of Object.entries(park.stations)) {
      const hit = castDown(phys, s.pos.x, s.pos.y + 3, s.pos.z, 10);
      expect(hit, name).not.toBeNull();
      expect(Math.abs(hit!.height - s.pos.y), name).toBeLessThan(0.1);
    }
  });

  it('has a ring and a zone for every park challenge spot, each ring inside its zone', () => {
    const spots = [...new Set(CHALLENGES.filter((c) => c.group === 'park').map((c) => c.spot))];
    expect(spots.length).toBe(8);
    for (const sp of spots) {
      expect(park.rings[sp], sp).toBeDefined();
      expect(park.zones[sp], sp).toBeDefined();
      expect(inZone(park.zones[sp], park.rings[sp].x, park.rings[sp].z), sp).toBe(true);
    }
  });

  it('keeps each lane\'s run-up from its station to its first lip the old park\'s length', () => {
    const firstLip = (c: typeof park, z: number) => Math.min(...c.lines.filter((l) => Math.abs(l.lip.z - z) < 0.01).map((l) => l.lip.x));
    // run-ups (m) from the deleted old park, frozen when it was deleted (Task 9)
    const lanes: [string, number, number][] = [
      ['Jumps S', LANES.S, 35.03203311199891], ['Jumps M', LANES.M, 36.812937120243014], ['Jumps L', LANES.L, 43.717691453623985],
      ['Jumps XL', XL_LANE, 38.97010610642197], ['Rhythm', RHYTHM.z, 17.991083966886478],
    ];
    for (const [name, z, was] of lanes) {
      const run = firstLip(park, z) - park.stations[name].pos.x;
      expect(Number.isFinite(run), name).toBe(true);
      expect(Math.abs(run - was), name).toBeLessThan(0.01);
    }
  });

  it('builds the same features: seven tables, five doubles and the plank\'s three lips', () => {
    expect(park.lines.length).toBe(1 + 2 + 3 + 1 + 5 + 3);
    expect(park.gates.length).toBe(SLALOM.count);
  });

  it('puts Whoop-de-Doo\'s roll-in on the hill, 3 m up, and the lanes at its foot', () => {
    expect(park.stations.Rhythm.pos.y).toBeCloseTo(3.04, 2);
    expect(park.stations['Start hill'].pos.y).toBeGreaterThan(3);
    expect(park.stations['Jumps S'].pos.y).toBeLessThan(0.1);
  });

  it('has coast zones for the pump track and Whoop-de-Doo', () => {
    expect(park.coast.some((a) => inZone(a, PUMP_TRACK.x, PUMP_TRACK.z))).toBe(true);
    expect(park.coast.some((a) => inZone(a, RHYTHM.x0 + 20, RHYTHM.z))).toBe(true);
  });

  it('hands its pump track and planks to the game', () => {
    expect(park.pumpTrack).toBe(PUMP_TRACK);
    expect(park.planks).toBe(PLANKS);
  });
});

describe('the park\'s plank watch', () => {
  it('reports on, then end, walked along the narrow plank', () => {
    const [p] = PLANKS, w = createPlankWatch(park.planks!), out: string[] = [];
    for (let x = p.x0 - 4; x <= p.x1 + 1; x += 0.25) {
      const e = w(at(x, p.z, x < p.x0 ? 0.02 : p.y));
      if (e) out.push(e);
    }
    expect(out).toEqual(['on', 'end']);
  });
});

describe('the park\'s lap line', () => {
  it('reports start, then check, for a lap walked along the pump track', () => {
    const { x, z, half, R } = PUMP_TRACK, pts: [number, number][] = [];
    for (let u = x - half - 3; u < x + half; u += 0.25) pts.push([u, z - R]);
    for (let a = 0; a < Math.PI; a += 0.25 / R) pts.push([x + half + R * Math.sin(a), z - R * Math.cos(a)]);
    for (let u = x + half; u > x - half; u -= 0.25) pts.push([u, z + R]);
    const out: string[] = [];
    for (let i = 1; i < pts.length; i++) {
      const e = lapEvent(at(pts[i - 1][0], pts[i - 1][1]), at(pts[i][0], pts[i][1]), park.pumpTrack!);
      if (e && out[out.length - 1] !== e) out.push(e);
    }
    expect(out).toEqual(['start', 'check']);
  });
});
