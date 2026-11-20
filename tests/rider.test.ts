import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRider, kneeAt, THIGH, SHIN, RIG_WHEEL, DEFAULT_FRAME, frameOf, riderScaleOf } from '../src/bike/rider';
import { createBikeState } from '../src/bike/controller';
import { BIKES } from '../src/rules/bikes';
import { LAB_BIKES, LAB_ORDER } from '../src/lab/bikes';
import { kitOf, withKit } from '../src/rules/bikes';
import { SLOTS, loadout, partsFor } from '../src/game/catalog';

describe('rider rig', () => {
  it('keeps thigh and shin lengths for any reachable pedal', () => {
    for (const [px, py] of [[-0.04, 0.5], [0.13, 0.33], [-0.04, 0.16], [-0.21, 0.33]]) {
      const [kx, ky] = kneeAt(-0.2, 0.98, px, py);
      expect(Math.hypot(kx + 0.2, ky - 0.98)).toBeCloseTo(THIGH);
      expect(Math.hypot(px - kx, py - ky)).toBeCloseTo(SHIN);
      expect(kx).toBeGreaterThan(-0.2); // knee points forward
    }
  });

  it('scales to the bike, so the Bayview rider is smaller', () => {
    expect(createRider(BIKES.bolinas).root.scale.x).toBeCloseTo(BIKES.bolinas.wheelRadius / RIG_WHEEL);
    expect(createRider(BIKES.bayview).root.scale.x).toBeLessThan(createRider(BIKES.bolinas).root.scale.x);
  });

  it('follows the bike state', () => {
    const rig = createRider(BIKES.bayview);
    const s = createBikeState(BIKES.bayview, new THREE.Vector3(3, 0.5, -2), 1.2);
    rig.update(s, 1 / 60, false);
    expect(rig.root.position.toArray()).toEqual([3, 0.5, -2]);
    expect(rig.root.rotation.y).toBeCloseTo(1.2);
  });

  it('keeps the Bolinas and Bayview frames as they are', () => {
    for (const b of [BIKES.bolinas, BIKES.bayview]) {
      const f = frameOf(b);
      expect({ ...f, wheel: 0 }).toEqual({ ...DEFAULT_FRAME, wheel: 0 });
      expect(f.wheel).toBeCloseTo(RIG_WHEEL);
    }
  });

  it('puts the same rider on the dirt jumper and the enduro', () => {
    expect(riderScaleOf(LAB_BIKES.dirtjumper)).toBe(riderScaleOf(LAB_BIKES.enduro));
  });

  it('gives the dirt jumper much smaller wheels and a shorter, lower frame', () => {
    const dj = LAB_BIKES.dirtjumper, en = LAB_BIKES.enduro;
    expect(frameOf(dj).wheel * riderScaleOf(dj)).toBeCloseTo(0.29);
    expect(frameOf(en).wheel * riderScaleOf(en)).toBeCloseTo(0.38);
    expect(frameOf(dj).axle).toBeLessThan(DEFAULT_FRAME.axle);
    expect(frameOf(en).axle).toBeGreaterThan(DEFAULT_FRAME.axle);
    expect(frameOf(dj).bar[1]).toBeLessThan(frameOf(en).bar[1]);
  });

  it('stands every lab bike on the ground', () => {
    for (const id of LAB_ORDER) {
      const rig = createRider(LAB_BIKES[id]);
      rig.update(createBikeState(LAB_BIKES[id], new THREE.Vector3(0, 0, 0), 0), 1 / 60, false);
      rig.root.updateMatrixWorld(true);
      // the tire tube is centered on the wheel radius, so every bike's tires sit a few cm into the ground (as today)
      const low = new THREE.Box3().setFromObject(rig.root).min.y;
      expect(low, id).toBeGreaterThan(-0.09);
      expect(low, id).toBeLessThan(0.01);
    }
  });

  it('a foot down stays on the rider: hip to knee to a shoe on the ground, nothing stretched', () => {
    const ends = (m: THREE.Object3D) => [m.localToWorld(new THREE.Vector3(0, -0.5, 0)), m.localToWorld(new THREE.Vector3(0, 0.5, 0))];
    for (const id of LAB_ORDER) {
      const rig = createRider(LAB_BIKES[id]);
      const s = createBikeState(LAB_BIKES[id], new THREE.Vector3(0, 0, 0), 0);
      s.grounded = true;
      s.speed = 0;
      (s as typeof s & { dab: number }).dab = 1;
      for (let i = 0; i < 90; i++) rig.update(s, 1 / 60, false);
      rig.root.updateMatrixWorld(true);
      const k = rig.root.scale.x;
      const get = (n: string) => rig.root.getObjectByName(n)!;
      const [hipDown, kneeT] = ends(get('thigh0')), [kneeS, foot] = ends(get('shin0')), [hipUp] = ends(get('thigh1'));
      expect(hipDown.distanceTo(hipUp) / k, `${id} hips stay together`).toBeLessThan(0.3);
      expect(kneeT.distanceTo(kneeS), `${id} knee joined`).toBeLessThan(1e-6);
      expect(hipDown.distanceTo(kneeT) / k, `${id} thigh`).toBeCloseTo(THIGH, 2);
      expect(kneeS.distanceTo(foot) / k, `${id} shin`).toBeCloseTo(SHIN, 2);
      const shoe = new THREE.Box3().setFromObject(get('shoe0'));
      expect(shoe.min.y, `${id} shoe on the ground`).toBeGreaterThan(-0.04);
      expect(shoe.min.y, `${id} shoe on the ground`).toBeLessThan(0.04);
      expect(Math.abs(foot.z) / k, `${id} foot out beside the bike`).toBeGreaterThan(0.25);
    }
  });

  const allBikes = () => [...Object.values(BIKES), ...LAB_ORDER.map((id) => LAB_BIKES[id])];
  const meshes = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse((c) => (c as THREE.Mesh).isMesh && out.push(c as THREE.Mesh)); return out; };
  const shoeLow = (rig: ReturnType<typeof createRider>) => Math.min(...[0, 1].map((i) => new THREE.Box3().setFromObject(rig.root.getObjectByName(`shoe${i}`)!).min.y));

  it('the stand pose puts a shoe on the floor and keeps both wheels on it', () => {
    for (const b of allBikes()) {
      const rig = createRider(b);
      rig.standPose();
      rig.root.updateMatrixWorld(true);
      const wheelLow = Math.min(...meshes(rig.root).filter((m) => m.geometry.type === 'TorusGeometry').map((m) => new THREE.Box3().setFromObject(m).min.y));
      expect(Math.abs(shoeLow(rig) - wheelLow), b.id).toBeLessThan(0.04);
      expect(Math.abs(wheelLow), `${b.id} wheels on the floor`).toBeLessThan(0.08);
    }
  });

  it('a rig without a rider has no rider meshes', () => {
    for (const b of allBikes()) {
      const rig = createRider(b, { rider: false });
      rig.root.updateMatrixWorld(true);
      expect(rig.root.getObjectByName('shoe0'), b.id).toBeUndefined();
      const top = new THREE.Box3().setFromObject(rig.root).max.y;
      expect(top, b.id).toBeLessThan(rig.root.scale.y * frameOf(b).bar[1] + 0.1);
      rig.standPose(); // must not throw without a rider
      rig.setRiderVisible(false);
    }
  });

  it('setRiderVisible(false) hides the rider and nothing of the bike', () => {
    const rig = createRider(BIKES.bolinas);
    const shown = (m: THREE.Object3D) => { for (let o: THREE.Object3D | null = m; o; o = o.parent) if (!o.visible) return false; return true; };
    const before = meshes(rig.root).filter((m) => shown(m)).length;
    rig.setRiderVisible(false);
    const bike = createRider(BIKES.bolinas, { rider: false });
    expect(meshes(rig.root).filter((m) => shown(m)).length).toBe(meshes(bike.root).length);
    expect(shown(rig.root.getObjectByName('shoe0')!)).toBe(false);
    rig.setRiderVisible(true);
    expect(meshes(rig.root).filter((m) => shown(m)).length).toBe(before);
  });

  it('setColor repaints the frame', () => {
    const rig = createRider(BIKES.bolinas), other = createRider(BIKES.bolinas);
    const tires = () => meshes(rig.root).filter((m) => m.geometry.type === 'TorusGeometry').map((m) => (m.material as THREE.MeshStandardMaterial).color.getHex());
    const t0 = tires();
    rig.setColor(0xff0000);
    const hexes = meshes(rig.root).map((m) => (m.material as THREE.MeshStandardMaterial).color.getHex());
    expect(hexes).toContain(0xff0000);
    expect(hexes.filter((h) => h === 0xff0000).length).toBe(1);
    expect(tires()).toEqual(t0);
    expect(meshes(other.root).map((m) => (m.material as THREE.MeshStandardMaterial).color.getHex())).not.toContain(0xff0000);
  });

  it('anchors sit on the bike', () => {
    for (const b of allBikes()) {
      const rig = createRider(b, { rider: false });
      const a = rig.anchors();
      expect(Object.keys(a).sort()).toEqual(['bars', 'cranks', 'fork', 'frontTire', 'rearHub']);
      for (const pose of [false, true]) {
        if (pose) rig.standPose();
        rig.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(rig.root).expandByScalar(1e-3);
        const ps = Object.entries(a).map(([k, o]) => [k, o.getWorldPosition(new THREE.Vector3())] as const);
        for (const [k, p] of ps) expect(box.containsPoint(p), `${b.id} ${k} ${pose}`).toBe(true);
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(ps[i][1].distanceTo(ps[j][1]), `${b.id} ${ps[i][0]}/${ps[j][0]}`).toBeGreaterThan(0.02);
      }
    }
  });
});

describe('the kit: fork, rear end, shock and brakes', () => {
  const has = (rig: ReturnType<typeof createRider>, n: string) => !!rig.root.getObjectByName(n);
  const worldY = (o: THREE.Object3D) => (o.updateWorldMatrix(true, false), o.getWorldPosition(new THREE.Vector3()).y);
  const meshes = (o: THREE.Object3D) => { let n = 0; o.traverse((m) => { if (m instanceof THREE.Mesh) n++; }); return n; };

  // every vertex of a named mesh, in world coordinates (the rig stands at the origin facing +x, z to its right)
  const pts = (root: THREE.Object3D, name: string): THREE.Vector3[] => {
    root.updateMatrixWorld(true);
    const m = root.getObjectByName(name) as THREE.Mesh, a = m.geometry.getAttribute('position'), out: THREE.Vector3[] = [];
    for (let i = 0; i < a.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld));
    return out;
  };
  const hub = (root: THREE.Object3D, name: string) => root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

  it('rim brakes reach the rim and stop just past the tire', () => {
    const spec = LAB_BIKES.hardtail, rig = createRider(spec), WR = frameOf(spec).wheel * riderScaleOf(spec), sc = riderScaleOf(spec);
    for (const [arms, wheel] of [['rimBrakeFront', 'wheelFront'], ['rimBrakeRear', 'wheelRear']] as const) {
      const c = hub(rig.root, wheel), d = pts(rig.root, arms).map((p) => Math.hypot(p.x - c.x, p.y - c.y));
      expect(Math.min(...d), `${arms} pads at the rim`).toBeLessThan(WR - 0.06 * sc);
      expect(Math.max(...d), `${arms} not floating above the tire`).toBeLessThan(WR + 0.15 * sc);
    }
  });

  it('rotors and calipers sit between the hub and the fork or stays', () => {
    const spec = LAB_BIKES.enduro, rig = createRider(spec), sc = riderScaleOf(spec);
    for (const n of ['rotorFront', 'rotorRear']) expect(Math.max(...pts(rig.root, n).map((p) => Math.abs(p.z))), n).toBeLessThan(0.07 * sc);
    // a caliper straddles its rotor: no further out than the outside of the leg
    for (const n of ['caliperFront', 'caliperRear']) expect(Math.max(...pts(rig.root, n).map((p) => Math.abs(p.z))), n).toBeLessThan(0.105 * sc);
  });

  it('each kit builds its pieces', () => {
    const ht = createRider(LAB_BIKES.hardtail), bo = createRider(LAB_BIKES.bolinas), en = createRider(LAB_BIKES.enduro), dj = createRider(LAB_BIKES.dirtjumper);
    expect(has(ht, 'rimBrakeFront') && has(ht, 'rimBrakeRear')).toBe(true);
    expect(has(ht, 'forkLowers')).toBe(false);
    expect(has(bo, 'forkLowers') && has(bo, 'oring') && has(bo, 'rotorFront') && has(bo, 'caliperFront')).toBe(true);
    expect(has(bo, 'swingarm')).toBe(false);
    expect(has(en, 'swingarm') && has(en, 'shockBody') && has(en, 'shockShaft') && has(en, 'rocker')).toBe(true);
    expect(has(en, 'shockSpring')).toBe(false);
    expect(has(createRider(loadout('enduro', { suspension: 'enduro-coil-shock' }).spec), 'shockSpring')).toBe(true);
    expect(has(dj, 'caliperRear')).toBe(true);
    expect(has(dj, 'caliperFront') || has(dj, 'rimBrakeFront')).toBe(false);
    for (const [design, piece] of [['singlePivot', 'swingarm'], ['shortLink', 'links']] as const) {
      const spec = { ...LAB_BIKES.enduro, kit: withKit(kitOf(LAB_BIKES.enduro), { rear: { design } }) };
      expect(has(createRider(spec), piece), design).toBe(true);
    }
  });

  it('the mesh budget holds for every bike and part mix', () => {
    for (const id of LAB_ORDER) {
      let fits: Record<string, string>[] = [{}];
      for (const slot of SLOTS) fits = fits.flatMap((f) => [f, ...partsFor(id, slot).filter((p) => !p.stock).map((p) => ({ ...f, [slot]: p.id }))]);
      for (const f of fits) expect(meshes(createRider(loadout(id, f).spec, { rider: false }).root), `${id} ${JSON.stringify(f)}`).toBeLessThanOrEqual(23);
    }
  });

  // a landing big enough to bottom out, with no whole-body squash, stepped to its deepest point
  function slam(id: keyof typeof LAB_BIKES) {
    const rig = createRider(LAB_BIKES[id]);
    const s = createBikeState(LAB_BIKES[id], new THREE.Vector3(0, 0, 0), 0);
    rig.update(s, 1 / 60, false);
    const a = rig.anchors(), front = rig.root.getObjectByName('wheelFront')!, rear = rig.root.getObjectByName('wheelRear')!;
    const rest = { bars: worldY(a.bars), front: worldY(front), rear: worldY(rear) };
    rig.land(0, 2);
    let barsLow = rest.bars, wheelMove = 0;
    for (let i = 0; i < 20; i++) {
      rig.update(s, 1 / 120, false);
      barsLow = Math.min(barsLow, worldY(a.bars));
      wheelMove = Math.max(wheelMove, Math.abs(worldY(front) - rest.front), Math.abs(worldY(rear) - rest.rear));
    }
    return { rig, s, rest, barsDrop: rest.bars - barsLow, wheelMove };
  }

  it('full compression sinks the frame, not the wheels', () => {
    const { barsDrop, wheelMove } = slam('enduro');
    expect(wheelMove).toBeLessThan(0.02);
    expect(barsDrop).toBeGreaterThan(0.05);
  });

  it("a rigid hardtail's frame doesn't sink", () => {
    expect(slam('hardtail').barsDrop).toBeLessThan(0.005);
  });

  it('the O-ring sits at the top of its travel on the stand, and stays down after a hit', () => {
    const rig = createRider(LAB_BIKES.bolinas);
    rig.standPose();
    const ring = rig.root.getObjectByName('oring')!, seal = ring.userData.seal as THREE.Vector3;
    expect(ring.position.x).toBeCloseTo(seal.x, 5);
    expect(ring.position.y).toBeCloseTo(seal.y, 5);
    const s = createBikeState(LAB_BIKES.bolinas, new THREE.Vector3(0, 0, 0), 0);
    rig.land(0, 0.8);
    for (let i = 0; i < 120; i++) rig.update(s, 1 / 60, false);
    expect(ring.position.y).toBeGreaterThan(seal.y + 0.03);
  });

  it('a crash carries the pieces, and getting back on starts the springs fresh', () => {
    const { rig, s, rest } = slam('enduro');
    const scene = new THREE.Scene();
    scene.add(rig.root);
    const body = { translation: () => ({ x: 0, y: 0, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) };
    const t = { bike: body, rider: body } as unknown as Parameters<typeof rig.detach>[0];
    rig.detach(t, scene);
    rig.followTumble(t);
    let p: THREE.Object3D | null = rig.root.getObjectByName('forkLowers') ?? scene.getObjectByName('forkLowers')!;
    while (p && p.parent && p.parent !== scene) p = p.parent;
    expect(p!.getObjectByName('rearHub') ?? p!.getObjectByName('forkLowers')).toBeTruthy();
    rig.reattach();
    rig.update(s, 1 / 60, false);
    expect(Math.abs(worldY(rig.anchors().bars) - rest.bars)).toBeLessThan(0.005);
  });

  const ride = (id: keyof typeof LAB_BIKES, frames: number, cues?: { braking: number; rough: boolean }, setup?: (s: ReturnType<typeof createBikeState>) => void) => {
    const rig = createRider(LAB_BIKES[id]);
    const s = createBikeState(LAB_BIKES[id], new THREE.Vector3(0, 0, 0), 0);
    rig.update(s, 1 / 60, false);
    const a = rig.anchors(), cal = rig.root.getObjectByName('caliperFront')!;
    const rest = { bars: worldY(a.bars), cal: cal.position.clone() };
    setup?.(s);
    for (let i = 0; i < frames; i++) rig.update(s, 1 / 60, false, cues);
    return { rig, s, rest, barsNow: worldY(a.bars), calMoved: cal.position.distanceTo(rest.cal) };
  };

  it('braking dives the fork and clamps the brakes', () => {
    const braked = ride('bolinas', 30, { braking: 1, rough: false });
    expect(braked.barsNow).toBeLessThan(braked.rest.bars - 0.01);
    expect(braked.calMoved).toBeGreaterThan(0.01);
    const coasting = ride('bolinas', 30);
    expect(Math.abs(coasting.barsNow - coasting.rest.bars)).toBeLessThan(0.002);
    expect(coasting.calMoved).toBeLessThan(0.001);
  });

  it('a manual stretches the fork', () => {
    const r = ride('bolinas', 40, undefined, (s) => { s.manual = 1; });
    const fork = r.rig.anchors().fork, lowers = r.rig.root.getObjectByName('forkLowers')!;
    // the lowers slide down the stanchions: the front end sits lower relative to the frame than at rest
    expect(lowers.parent!.position.y).toBeLessThan(-0.01);
    expect(fork).toBeTruthy();
  });

  it('rough ground chatters the suspension', () => {
    const r = ride('enduro', 60, { braking: 0, rough: true }, (s) => { s.speed = 6; });
    let moved = 0;
    const a = r.rig.anchors();
    for (let i = 0; i < 30; i++) {
      r.rig.update(r.s, 1 / 60, false, { braking: 0, rough: true });
      moved = Math.max(moved, Math.abs(worldY(a.bars) - r.rest.bars));
    }
    expect(moved).toBeGreaterThan(0.003);
  });

  it('pumping squishes it once per press, not for as long as it is held', () => {
    const pump = { braking: 0, rough: false, pumping: true }, off = { braking: 0, rough: false, pumping: false };
    const r = ride('enduro', 1);
    const bars = () => worldY(r.rig.anchors().bars);
    let low = r.rest.bars;
    for (let i = 0; i < 20; i++) { r.rig.update(r.s, 1 / 60, false, pump); low = Math.min(low, bars()); }
    expect(r.rest.bars - low).toBeGreaterThan(0.02);
    // still held: the stroke is over and the bike is back up, and the O-ring only shows the stroke
    for (let i = 0; i < 40; i++) r.rig.update(r.s, 1 / 60, false, pump);
    expect(Math.abs(bars() - r.rest.bars)).toBeLessThan(0.01);
    // let go and press again: another stroke
    r.rig.update(r.s, 1 / 60, false, off);
    low = bars();
    for (let i = 0; i < 20; i++) { r.rig.update(r.s, 1 / 60, false, pump); low = Math.min(low, bars()); }
    expect(r.rest.bars - low).toBeGreaterThan(0.02);
  });

  it('a crash keeps the O-ring where the hit before it pushed it', () => {
    const r = ride('bolinas', 1);
    const ring = r.rig.root.getObjectByName('oring')!, seal = ring.userData.seal as THREE.Vector3;
    r.rig.land(0, 0.9);
    for (let i = 0; i < 60; i++) r.rig.update(r.s, 1 / 60, false);
    const pushed = ring.position.y;
    expect(pushed).toBeGreaterThan(seal.y + 0.03);
    const scene = new THREE.Scene();
    scene.add(r.rig.root);
    const body = { translation: () => ({ x: 0, y: 0, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) };
    const t = { bike: body, rider: body } as unknown as Parameters<typeof r.rig.detach>[0];
    r.rig.detach(t, scene);
    // the moving pieces go with the bike: the fork lowers' top-level parent under the scene holds the frame too
    let top: THREE.Object3D = scene.getObjectByName('forkLowers')!;
    while (top.parent !== scene) top = top.parent!;
    expect(top.getObjectByName('wheelFront')).toBeTruthy();
    expect(top.getObjectByName('thigh0')).toBeUndefined();
    r.rig.reattach();
    r.rig.update(r.s, 1 / 60, false);
    expect(ring.position.y).toBeCloseTo(pushed, 4);
  });

  it('the O-ring keeps the deepest hit until resetHits', () => {
    const r = ride('bolinas', 1);
    const ring = r.rig.root.getObjectByName('oring')!, seal = ring.userData.seal as THREE.Vector3;
    r.rig.land(0, 0.9);
    for (let i = 0; i < 120; i++) r.rig.update(r.s, 1 / 60, false);
    expect(ring.position.y).toBeGreaterThan(seal.y + 0.03);
    r.rig.resetHits();
    r.rig.update(r.s, 1 / 60, false);
    expect(ring.position.y).toBeCloseTo(seal.y, 4);
  });

  it('a fresh rig after a swap starts with the O-ring at the top', () => {
    const r = ride('bolinas', 1);
    r.rig.land(0, 1);
    for (let i = 0; i < 30; i++) r.rig.update(r.s, 1 / 60, false);
    const next = createRider(LAB_BIKES.bolinas);
    next.update(r.s, 1 / 60, false);
    const ring = next.root.getObjectByName('oring')!, seal = ring.userData.seal as THREE.Vector3;
    expect(ring.position.y).toBeCloseTo(seal.y, 5);
  });
});
