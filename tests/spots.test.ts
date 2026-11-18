import { describe, it, expect, beforeAll } from 'vitest';
import { lapEvent, createPlankWatch, runEvent } from '../src/game/spots';
import { castDown, createPhysics, type Physics } from '../src/world/physics';
import { CHALLENGES } from '../src/game/challenges';
import { inZone, trailPoint } from '../src/world/trail';
import type { Gate } from '../src/lab/course';
import { buildPark, PUMP_TRACK as PT, PLANKS, SLALOM } from '../src/world/places/park';
import { buildHill } from '../src/world/places/hill';
import { hairpin } from '../src/world/trails/hairpin';
import { placeOfStation } from '../src/world/places';

const at = (x: number, z: number, y = 0.1, grounded = true) => ({ x, y, z, grounded });
const park = buildPark(), hill = buildHill();
const T = hill.trails;
const placeOf = (spot: string) => (placeOfStation(spot) === 'mesaJumpPark' ? park : hill);
let hillPhys: Physics;
beforeAll(async () => { hillPhys = await createPhysics(hill.world); });

describe('pump track lap line', () => {
  const near = PT.z - PT.R, far = PT.z + PT.R, x = PT.x;
  it('fires start when crossing the line on the near straight going round the right way', () => {
    expect(lapEvent(at(x - 13, near), at(x - 11, near), PT)).toBe('start');
    expect(lapEvent(at(x - 11, near), at(x - 13, near), PT)).toBeNull(); // the wrong way
    expect(lapEvent(at(x - 11, near), at(x - 10, near), PT)).toBeNull(); // already past
  });

  it('fires check on the far straight', () => {
    expect(lapEvent(at(x + 1, far), at(x + 0.5, far), PT)).toBe('check');
    expect(lapEvent(at(x + 1, near), at(x + 0.5, near), PT)).toBeNull();
  });
});

describe('Cone Zone', () => {
  it('the slalom has ten gates in the lot, alternating sides', () => {
    expect(SLALOM.count).toBe(10);
    expect(park.gates.length).toBe(SLALOM.count);
    const mids = park.gates.map((g) => [(g.a.x + g.b.x) / 2, (g.a.y + g.b.y) / 2 - SLALOM.z!]);
    for (const [, dz] of mids) expect(Math.abs(dz)).toBeLessThanOrEqual(3);
    for (let i = 1; i < mids.length; i++) expect(Math.sign(mids[i][1])).toBe(-Math.sign(mids[i - 1][1]));
    expect((CHALLENGES.find((c) => c.id === 'coneZone')!.goal as { count: number }).count).toBe(park.gates.length);
  });
});

describe('Boulder Dash', () => {
  const bd = T.boulderDash, BOULDERS: [number, number] = [75, 90]; // the u span the three boulders cover
  const lanes = (): number[] => { const l: number[] = []; for (let off = -1.4; off <= 1.4 + 1e-6; off += 0.2) l.push(off); return l; };
  const hit = (u: number, off: number) => { const p = trailPoint(bd, u, off); return castDown(hillPhys, p.x, p.y + 40, p.z, 80); };
  it('has a lip before the boulders', () => {
    const lips = hill.lines.filter((l) => { const n = bd.path.nearest(l.lip.x, l.lip.z); return l.land && n.dist < 2 && n.u < BOULDERS[0]; });
    expect(lips.length).toBeGreaterThanOrEqual(1);
  });

  it('has boulders you must swerve round: no straight lane through, but always a way past', () => {
    const blocked = new Set<number>();
    for (let u = BOULDERS[0]; u <= BOULDERS[1]; u += 0.25) {
      const hits = lanes().filter((off) => hit(u, off)?.surface === 'rock');
      expect(hits.length, `u ${u}: some way past`).toBeLessThan(lanes().length);
      for (const off of hits) blocked.add(off);
    }
    expect(blocked.size, 'every lane meets a boulder').toBe(lanes().length);
  });

  it('the boulders are too big to plow (taller than 0.35 m)', () => {
    let tallest = 0;
    for (let u = BOULDERS[0]; u <= BOULDERS[1]; u += 0.25)
      for (const off of lanes()) {
        const top = hit(u, off), ground = hit(u, 3.2);
        if (top?.surface === 'rock' && ground) tallest = Math.max(tallest, top.height - ground.height);
      }
    expect(tallest).toBeGreaterThan(0.45);
  });
});

describe('Hairpin Hollow', () => {
  const hp = T.hairpin;
  const lips = hill.lines.filter((l) => hp.path.nearest(l.lip.x, l.lip.z).dist < 0.5 && l.land);
  it('climbs: the top is about 10 m up', () => {
    const rise = hill.stations['Switchbacks top'].pos.y - hill.stations.Switchbacks.pos.y;
    expect(rise).toBeGreaterThan(8);
    expect(rise).toBeLessThan(12);
  });

  it('has two lips facing down the trail, for tricks on the way down', () => {
    expect(lips.length).toBe(2);
    for (const l of lips) expect(Math.cos(l.yaw - (hp.path.at(hp.path.nearest(l.lip.x, l.lip.z).u).yaw + Math.PI))).toBeGreaterThan(0.99);
  });

  it('each step-down\'s landing runs down into flat ground (no kick at its foot)', () => {
    for (const l of lips) {
      const dx = Math.cos(l.yaw), dz = -Math.sin(l.yaw), a = l.land!.knuckle, b = a + l.land!.length;
      const h = (s: number) => castDown(hillPhys, l.lip.x + dx * s, 60, l.lip.z + dz * s, 100)!.height;
      let low = Infinity, worst = 0; // the most the ground climbs back above its lowest point so far
      for (let s = a; s < b + 2; s += 0.1) { // to 2 m past the foot
        low = Math.min(low, h(s));
        worst = Math.max(worst, h(s) - low);
      }
      expect(worst, `lip at ${l.lip.x.toFixed(1)}, ${l.lip.z.toFixed(1)}`).toBeLessThan(0.03);
      // and the line's drop is the real one: lip to the foot of the landing
      expect(l.land!.drop).toBeCloseTo(l.lip.y - h(b), 1);
    }
  });

  it('the climbing rules cover every leg', () => {
    hairpin().marks.legs.forEach(([a, b], i) => {
      const p = trailPoint(hp, (a + b) / 2);
      expect(hill.climb.area.some((z) => inZone(z, p.x, p.z)), `leg ${i + 1}`).toBe(true);
    });
  });
});

describe('plank watch', () => {
  const [p] = PLANKS;
  const top = p.y;
  it('sees you get on, ride along and reach the end', () => {
    const w = createPlankWatch(PLANKS);
    expect(w(at(p.x0 - 6, p.z))).toBeNull();
    expect(w(at(p.x0 + 2, p.z, top))).toBe('on');
    expect(w(at(p.x0 + 6, p.z, top))).toBeNull();
    expect(w(at(p.x1 + 0.2, p.z, top))).toBe('end');
    expect(w(at(p.x1 + 0.5, p.z, top))).toBeNull(); // once
  });

  it('sees you fall off the side, but not while you are in the air', () => {
    const w = createPlankWatch(PLANKS);
    w(at(p.x0 + 2, p.z, top));
    expect(w(at(p.x0 + 4, p.z + 1, top - 0.2, false))).toBeNull();
    expect(w(at(p.x0 + 5, p.z + 1.2, 0.02))).toBe('off');
  });

  it('the wide plank is practice: it never starts the challenge (so the gap can\'t be skipped)', () => {
    const wide = PLANKS[1];
    expect(createPlankWatch(PLANKS)(at(wide.x0 + 2, wide.z, top))).toBeNull();
    expect(wide.gap).toBeUndefined();
  });

  it('the narrow plank has a gap in the middle, clear of both ends', () => {
    const [g0, g1] = p.gap!;
    expect(g1 - g0).toBeGreaterThanOrEqual(0.9);
    expect(g1 - g0).toBeLessThanOrEqual(2); // 1.8: the full hardtail clears it only by giving up the manual (robots, Nov 7)
    expect(g0 - p.x0).toBeGreaterThanOrEqual(3);
    expect(p.x1 - g1).toBeGreaterThanOrEqual(3);
  });

  it('a slow roll into the gap is falling off', () => {
    const w = createPlankWatch(PLANKS), mid = (p.gap![0] + p.gap![1]) / 2;
    w(at(p.x0 + 2, p.z, top));
    expect(w(at(mid, p.z, 0.02))).toBe('off');
  });

  it('flying over the gap is fine', () => {
    const w = createPlankWatch(PLANKS), mid = (p.gap![0] + p.gap![1]) / 2;
    w(at(p.x0 + 2, p.z, top));
    expect(w(at(mid, p.z, top + 0.2, false))).toBeNull();
    expect(w(at(p.gap![1] + 0.5, p.z, top))).toBeNull();
    expect(w(at(p.x1 + 0.2, p.z, top))).toBe('end');
  });

  it('the plank has a lip at the gap, so line assist carries a hop onto the far half', () => {
    const lip = park.lines.find((l) => Math.abs(l.lip.z - p.z) < 0.01 && Math.abs(l.lip.x - p.gap![0]) < 0.01);
    expect(lip?.after).toBeCloseTo(p.x1 - p.gap![1], 5);
  });

  it('ignores the ground next to the plank before you get on', () => {
    expect(createPlankWatch(PLANKS)(at(p.x0 + 5, p.z + 1.2, 0.02))).toBeNull();
  });
});

describe('spots', () => {
  it('has a start ring at the top for every ↓ run', () => {
    for (const id of ['goatDown', 'hairpinDown']) {
      const c = CHALLENGES.find((x) => x.id === id)!;
      expect(c.spot, id).toMatch(/Summit|top/);
      expect(hill.rings[c.spot], id).toBeDefined();
      expect(hill.zones[c.spot], id).toBeDefined();
    }
    expect(hill.stations.Summit.pos.y).toBeGreaterThan(10);
  });

  it('has a zone and a ring for every challenge spot, and both hold the start', () => {
    for (const c of CHALLENGES) {
      const course = placeOf(c.spot), zone = course.zones[c.spot], ring = course.rings[c.spot], st = course.stations[c.spot];
      expect(zone, c.spot).toBeDefined();
      expect(st, c.spot).toBeDefined();
      expect(inZone(zone, st.pos.x, st.pos.z), `${c.spot} start`).toBe(true);
      expect(inZone(zone, ring.x, ring.z), `${c.spot} ring`).toBe(true);
    }
  });

  // a jump line is one way: its spot must hold every lip it starts and the run-out after the last landing, or a
  // rider who missed a jump rolls off the end of the dirt into "You left the spot" while still on the trail
  it('holds every jump line of a jump challenge, with 5 m of run-out after the last landing', () => {
    for (const c of CHALLENGES.filter((x) => x.goal.kind === 'jumps')) {
      const course = placeOf(c.spot), zone = course.zones[c.spot];
      const lines = course.lines.filter((l) => l.land && inZone(zone, l.lip.x, l.lip.z));
      expect(lines.length, c.id).toBeGreaterThanOrEqual((c.goal as { count: number }).count);
      for (const l of lines) {
        const end = l.lip.x + l.land!.knuckle + l.land!.length + 5;
        expect(inZone(zone, end, l.lip.z), `${c.id}: run-out after the landing at x ${end.toFixed(1)}`).toBe(true);
      }
    }
  });

  it('puts each ring at its start, apart from the pump track', () => {
    for (const c of CHALLENGES.filter((c) => c.spot !== 'Pump track')) {
      const course = placeOf(c.spot), ring = course.rings[c.spot], st = course.stations[c.spot].pos;
      expect(Math.hypot(ring.x - st.x, ring.z - st.z), c.spot).toBeLessThan(1);
    }
  });

  it('keeps the pump track ring off the track, so laps never ride through it', () => {
    const r = park.rings['Pump track'];
    const dx = Math.max(0, Math.abs(r.x - PT.x) - PT.half), dz = Math.abs(r.z - PT.z);
    expect(Math.hypot(dx, dz)).toBeGreaterThan(PT.R + PT.width / 2 + 2.5);
  });
});

describe('the places', () => {
  const SPOTS = ['Rhythm', 'Rock chute', 'Switchbacks', 'Switchbacks top', 'Jumps XL', 'Climb', 'Summit'];
  it('has a station, zone and ring for each feature place', () => {
    for (const spot of SPOTS) {
      const course = placeOf(spot);
      expect(course.stations[spot], spot).toBeDefined();
      expect(course.zones[spot], spot).toBeDefined();
      expect(course.rings[spot], spot).toBeDefined();
    }
  });

  it('has rough ground on the rock chute', () => {
    expect(hill.rough.length).toBeGreaterThan(0);
  });

  it('starts every station on riding ground', async () => {
    const parkPhys = await createPhysics(park.world);
    for (const spot of SPOTS) {
      const course = placeOf(spot), phys = course === park ? parkPhys : hillPhys, p = course.stations[spot].pos, g = castDown(phys, p.x, p.y + 2, p.z, 10);
      expect(g?.surface, spot).toMatch(/dirt|ground|ramp/);
      expect(Math.abs(g!.height - p.y), spot).toBeLessThan(0.3);
    }
  });

  const across = (g: Gate, back = false) => {
    const mx = (g.a.x + g.b.x) / 2, mz = (g.a.y + g.b.y) / 2;
    const nx = -(g.b.y - g.a.y), nz = g.b.x - g.a.x, n = Math.hypot(nx, nz), d = back ? -0.5 : 0.5;
    return [at(mx - (nx / n) * d, mz - (nz / n) * d), at(mx + (nx / n) * d, mz + (nz / n) * d)] as const;
  };
  const RUNS = CHALLENGES.filter((c) => c.goal.kind === 'run');

  it('sees the start, top and finish lines of every timed run, the right way only', () => {
    expect(RUNS.length).toBe(7);
    for (const c of RUNS) {
      const r = hill.runs[c.id];
      expect(r, c.id).toBeDefined();
      const [s0, s1] = across(r.start);
      expect(runEvent(c.id, s0, s1, hill.runs), c.id).toBe('start');
      expect(runEvent(c.id, s1, s0, hill.runs), c.id).not.toBe('start');
      const [f0, f1] = across(r.finish);
      expect(runEvent(c.id, f0, f1, hill.runs), c.id).toBe('finish');
      const goal = c.goal as { via?: boolean };
      expect(!!r.via, c.id).toBe(!!goal.via);
      if (r.via) {
        const [v0, v1] = across(r.via);
        expect(runEvent(c.id, v0, v1, hill.runs), c.id).toBe('via');
        expect(runEvent(c.id, v1, v0, hill.runs), c.id).toBeNull();
      }
      for (const g of [r.start, r.finish, r.via].filter(Boolean) as Gate[]) {
        const zone = hill.zones[c.spot], mx = (g.a.x + g.b.x) / 2, mz = (g.a.y + g.b.y) / 2;
        expect(inZone(zone, mx, mz), `${c.id} line in its zone`).toBe(true);
      }
    }
    expect(runEvent('nothing', at(0, 0), at(1, 0), hill.runs)).toBeNull();
  });

  it('starts every run just ahead of its ring, riding the way the station faces', () => {
    for (const c of RUNS) {
      const st = hill.stations[c.spot];
      const step = (d: number) => at(st.pos.x + Math.cos(st.yaw) * d, st.pos.z - Math.sin(st.yaw) * d);
      let ev: string | null = null;
      for (let d = 0; d < 10 && !ev; d += 0.25) ev = runEvent(c.id, step(d), step(d + 0.25), hill.runs);
      expect(ev, c.id).toBe('start');
    }
  });

  it('runs each both-ways run up its ↑ and back down its ↓', () => {
    const r = hill.runs;
    for (const [both, up, down] of [['goatBoth', 'goatUp', 'goatDown'], ['hairpinBoth', 'hairpinUp', 'hairpinDown']]) {
      expect(r[both].start, both).toEqual(r[up].start);
      expect(r[both].via, both).toEqual(r[up].finish);
      expect(r[both].finish, both).toEqual(r[down].finish);
    }
  });
});
