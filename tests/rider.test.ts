import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRider, kneeAt, THIGH, SHIN, RIG_WHEEL, DEFAULT_FRAME, frameOf, riderScaleOf } from '../src/bike/rider';
import { createBikeState } from '../src/bike/controller';
import { BIKES } from '../src/rules/bikes';
import { LAB_BIKES, LAB_ORDER } from '../src/lab/bikes';

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
