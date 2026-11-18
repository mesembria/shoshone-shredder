// Trail edges on the hill: tall grass beside the trails that slows you hard, and firm plant clumps where an edge must
// hold (beside obstacles you could skip, round the outside of switchbacks, round Hairpin Hollow's top platform).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildHill } from '../src/world/places/hill';
import { bumpers } from '../src/lab/course';
import { createPhysics, castDown, rayHit, type Physics } from '../src/world/physics';
import { createLabState, placeBike, stepLab, type LabIntent } from '../src/lab/bike';
import { LAB_BIKES, applyBike } from '../src/lab/bikes';
import { T, DEFAULTS } from '../src/lab/tune';
import { goatLadder } from '../src/world/trails/goatLadder';
import { hairpin, HAIRPIN } from '../src/world/trails/hairpin';
import { boulderDash } from '../src/world/trails/boulderDash';
import { obstacleSpans, trailPoint, type Trail } from '../src/world/trail';

const hill = buildHill(), TR = hill.trails;
const gm = goatLadder().marks, hm = hairpin().marks, bm = boulderDash().marks;
const GT = Math.PI * 3.5, HT = Math.PI * HAIRPIN.SR; // a Goat Ladder and a Hairpin switchback's length
// Goat Ladder's leg 1 rock garden: its boulders on the edges stay rocks (they're the garden, not an edge line)
const garden = (() => {
  const rs = goatLadder().features.rocks.filter((r) => r.trail.id === 'goatUp' && Math.abs(r.off) > 1.5);
  return [Math.min(...rs.map((r) => r.u)) - 1, Math.max(...rs.map((r) => r.u)) + 1];
})();
let phys: Physics;
beforeAll(async () => { phys = await createPhysics(hill.world); });

const surfaceBeside = (t: Trail, u: number, side: number, k = 0.8) => {
  const p = trailPoint(t, u, side * (t.width / 2 + k));
  return castDown(phys, p.x, p.y + 5, p.z, 10)?.surface;
};

describe('tall grass along the trail edges', () => {
  it('lines Goat Ladder up, Hairpin Hollow and Boulder Dash, except the rock garden and the chute', () => {
    // every leg from where it leaves the trailhead lot, clear of the switchbacks' boulders (they reach a metre or two
    // along the legs' inner sides, where the legs close in on each other) and of the boulder in Goat Ladder's summit turn,
    // to Hairpin Hollow's top platform (where clumps take over)
    const spans: [Trail, number, number][] = [];
    const [s1, s2] = gm.switchbacks;
    for (const [a, b] of [[12, s1 - 1.2], [s1 + GT + 1.2, s2 - 1.2], [s2 + GT + 1.2, TR.goatUp.path.length - 2]]) {
      if (a < garden[0] && b > garden[1]) spans.push([TR.goatUp, a, garden[0]], [TR.goatUp, garden[1], b]);
      else spans.push([TR.goatUp, a, b]);
    }
    for (const [a, b] of hm.legs) spans.push([TR.hairpin, Math.max(a + 2.5, 18), b > TR.hairpin.path.length - 0.01 ? b - 4.5 : b - 2.5]);
    // Boulder Dash: past the rock garden (the steep chute and the garden keep their rock lines) to the finish
    spans.push([TR.boulderDash, bm.bEnd + 0.5, bm.finishU]);
    let n = 0;
    const off: string[] = [];
    for (const [t, a, b] of spans) for (let u = a; u <= b; u += 0.5) for (const side of [-1, 1]) {
      const s = surfaceBeside(t, u, side);
      if (s !== 'tallgrass') off.push(`${t.id} u ${u.toFixed(1)} ${side > 0 ? 'right' : 'left'}: ${s}`);
      n++;
    }
    expect(off).toEqual([]);
    expect(n).toBeGreaterThan(1200);
  });

  it('runs round the outside of every switchback too', () => {
    const [s1, s2] = gm.switchbacks;
    // side: +1 turns right. Goat Ladder's first turns right, its second left; Hairpin's alternate, left first
    for (const [t, u0, len, side] of [[TR.goatUp, s1, GT, 1], [TR.goatUp, s2, GT, -1], ...hm.switchbacks.map((u, i) => [TR.hairpin, u, HT, i % 2 ? 1 : -1])] as [Trail, number, number, number][]) {
      for (let u = u0 + 0.5; u < u0 + len - 0.5; u += 0.5) expect(surfaceBeside(t, u, -side, 0.3), `${t.id} turn at ${u0.toFixed(0)}, u ${u.toFixed(1)}`).toBe('tallgrass');
    }
  });

  it('keeps the rock lines down the chute and through the rock garden', () => {
    let rock = 0, n = 0;
    for (let u = 1; u < bm.bEnd - 1; u += 0.5) for (const side of [-1, 1]) {
      n++;
      if (surfaceBeside(TR.boulderDash, u, side, 0.55) === 'rock') rock++;
    }
    expect(rock / n).toBeGreaterThan(0.5);
  });

  it('never sits above the riding surface: the trails are still dirt edge to edge', () => {
    for (const t of Object.values(TR)) for (let u = 0.25; u < t.path.length; u += 0.5) for (const off of [-t.width / 2 + 0.05, t.width / 2 - 0.05]) {
      const p = trailPoint(t, u, off), hit = castDown(phys, p.x, p.y + 5, p.z, 10);
      expect(hit?.surface, `${t.id} u ${u} off ${off}`).not.toBe('tallgrass');
    }
  });

  it('slows a coasting bike to a stop in under half the distance plain grass takes', async () => {
    const root = new THREE.Group();
    for (const [z, surface] of [[0, 'grass'], [20, 'tallgrass']] as const) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 10));
      strip.position.set(90, -0.5, z);
      strip.userData.collide = surface;
      root.add(strip);
    }
    const yard = await createPhysics(root);
    const coast = (z: number) => {
      Object.assign(T, DEFAULTS);
      applyBike('hardtail');
      T.cruise = 0; // the stick centred asks for nothing: no pedalling, no brakes
      const pos = new THREE.Vector3(0, 0.02, z), s = createLabState(LAB_BIKES.hardtail, pos.clone(), 0);
      placeBike(s, pos.clone(), 0);
      const go: LabIntent = { steer: 0, throttle: 0, hop: null, swipe: null, again: false, crouch: false };
      for (let i = 0; i < 3; i++) stepLab(s, go, 1 / 60, yard, []);
      s.speed = 6;
      const x0 = s.pos.x;
      for (let i = 0; i < 60 * 30 && s.speed > 0.01; i++) stepLab(s, go, 1 / 60, yard, []);
      expect(s.speed).toBeLessThan(0.05);
      return s.pos.x - x0;
    };
    const grass = coast(0), tall = coast(20);
    Object.assign(T, DEFAULTS);
    expect(grass).toBeGreaterThan(5);
    expect(tall).toBeLessThan(grass / 2);
  });
});

describe('plant clumps where an edge must be firm', () => {
  // a sideways look from the trail's edge out across the grass, at handlebar height: does something solid stop it?
  // (out to the ground 1.6 m past the edge, which may lie lower than the trail: the plants stand on it)
  const firmAt = (t: Trail, u: number, side: number) => {
    const a = trailPoint(t, u, side * (t.width / 2 - 0.1), 0.6), b = trailPoint(t, u, side * (t.width / 2 + 1.6));
    b.y = hill.ground!(b.x, b.z) + 0.6;
    const d = b.sub(a);
    return rayHit(phys, a, d.clone().normalize(), d.length()) !== null;
  };
  // how much of u0..u1 is closed beside the trail on that side
  const closed = (t: Trail, u0: number, u1: number, side: number) => {
    let hit = 0, n = 0;
    for (let u = u0; u <= u1; u += 0.25, n++) if (firmAt(t, u, side)) hit++;
    return hit / n;
  };

  // Stepping sideways off the trail at u: out to REACH metres past the edge, the rider meets tall grass (which drags them
  // to a stop) or something solid (a clump, a rock) at handlebar height; rock ground beside the trail counts as a rock line. Tall grass counts only if it starts within
  // 0.6 m of the edge and runs unbroken for REACH (the band is ~1.6 m wide), so a bare strip a bike could cruise along doesn't pass.
  const REACH = 1.4;
  const reach = (t: Trail, u: number, side: number): string | null => {
    const a = trailPoint(t, u, side * (t.width / 2 - 0.1), 0.6), b = trailPoint(t, u, side * (t.width / 2 + REACH));
    b.y = a.y;
    const d = b.sub(a);
    if (rayHit(phys, a, d.clone().normalize(), d.length()) !== null) return null; // something solid stops them
    for (let k = 0.6; k <= REACH; k += 0.2) {
      const s = surfaceBeside(t, u, side, k);
      if (s !== 'tallgrass' && s !== 'rock') return `${s} at ${k.toFixed(1)} m out`;
    }
    return null;
  };

  it('closes both edges beside every obstacle you could ride round: grass or a clump within reach, on every trail', () => {
    const feats = [goatLadder().features, hairpin().features, boulderDash().features];
    const failures: string[] = [];
    let n = 0, spans = 0;
    for (const t of Object.values(TR)) for (const f of feats) for (const [a, b] of obstacleSpans(f, t)) {
      // Boulder Dash's chute and rock garden keep their rock lines (boulders with plain ground between them: a deliberate
      // line to pick, the same exception the grass test makes); everything past them is checked
      if (t.id === 'boulderDash' && b < bm.bEnd + 0.5) continue;
      spans++;
      for (let u = a; u <= b + 1e-9; u += 0.25) for (const side of [-1, 1]) {
        n++;
        const why = reach(t, Math.min(u, t.path.length), side);
        if (why) failures.push(`${t.id} obstacle ${a.toFixed(1)}-${b.toFixed(1)}, u ${u.toFixed(2)}, ${side > 0 ? 'right' : 'left'}: ${why}`);
      }
    }
    expect(failures).toEqual([]);
    expect(spans).toBeGreaterThan(10);
    expect(n).toBeGreaterThan(300);
  });

  it('closes the outside of every switchback', () => {
    const [s1, s2] = gm.switchbacks;
    for (const [t, u0, len, side, what] of [[TR.goatUp, s1, GT, 1, 'goat 1'], [TR.goatUp, s2, GT, -1, 'goat 2'], ...hm.switchbacks.map((u, i) => [TR.hairpin, u, HT, i % 2 ? 1 : -1, `hairpin ${i + 1}`])] as [Trail, number, number, number, string][]) {
      expect(closed(t, u0 + 0.3, u0 + len - 0.3, -side), what).toBeGreaterThan(0.8);
      // and the lateral-reach rule, at every sample round the outside of the turn
      const bad: string[] = [];
      for (let u = u0 + 0.3; u <= u0 + len - 0.3; u += 0.25) { const why = reach(t, u, -side); if (why) bad.push(`u ${u.toFixed(2)}: ${why}`); }
      expect(bad, `${what} outside reach`).toEqual([]);
    }
  });

  it('leaves the spur out of Hairpin Hollow\'s top platform open', () => {
    const s = TR.spur;
    for (const off of [-0.8, 0, 0.8]) {
      const a = trailPoint(s, 0.2, off, 0.6), b = trailPoint(s, 6, off, 0.6), d = b.clone().sub(a);
      expect(rayHit(phys, a, d.clone().normalize(), d.length()), `spur off ${off}`).toBeNull();
    }
  });

  it('bumps a rider who touches one, and stays put (the old park\'s bushes still burst and grow back)', () => {
    const firm = bumpers([{ x: 0, z: 0, r: 0.5, kind: 'yucca' }], { firm: true });
    const near = new THREE.Vector3(0.8, 0, 0), far = new THREE.Vector3(5, 0, 0);
    expect(firm.update(1 / 60, near)).not.toBeNull();
    expect(firm.update(1 / 60, near)).toBeNull(); // once per touch, not every frame
    firm.update(2, far);
    expect(firm.update(1 / 60, near)).not.toBeNull();
    const m = new THREE.Matrix4(), s = new THREE.Vector3();
    firm.meshes[0].getMatrixAt(0, m);
    expect(s.setFromMatrixScale(m).x).toBeGreaterThan(0.4); // still there
    expect(firm.solid).not.toBeNull();
    // riding past a metre and a bit beside one (clear of it: the body is 0.3 m round) is no bump
    const beside = bumpers([{ x: 0, z: 0, r: 0.5, kind: 'cactus' }], { firm: true });
    for (let x = -4; x <= 4; x += 0.1) expect(beside.update(1 / 60, new THREE.Vector3(x, 0, 1.15)), `x ${x.toFixed(1)}`).toBeNull();
    // but riding into one head on is, a little before the middle of the bike reaches it
    const ahead = bumpers([{ x: 0, z: 0, r: 0.5, kind: 'cactus' }], { firm: true });
    let at = -1;
    for (let x = -4; x <= 0 && at < -0.5; x += 0.05) if (ahead.update(1 / 60, new THREE.Vector3(x, 0, 0))) at = x;
    expect(at).toBeLessThan(-1.1);

    const loose = bumpers([{ x: 0, z: 0, r: 0.85, kind: 'bush' }]);
    expect(loose.solid).toBeNull();
    expect(loose.update(1 / 60, new THREE.Vector3(0.5, 0, 0))).not.toBeNull();
    loose.meshes[0].getMatrixAt(0, m);
    expect(s.setFromMatrixScale(m).x).toBeLessThan(0.01); // burst
  });
});
