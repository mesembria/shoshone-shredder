// The bike's moving parts, built from its kit (src/rules/bikes.ts): the fork, the rear end and shock, the brakes. Each
// moving piece is its own mesh with its own pivot; the parts that never move go back to the rig to merge by color.
// Model units, as in rider.ts: x forward, y up from the ground, z to the bike's right (rotors and calipers on the left).
//
// Compression (KitPose.fork, .rear, the share of travel from src/bike/springs.ts) moves the wheels up toward the
// frame; pose() returns how far each end of the frame must drop so the wheels stay on the ground, and the rig sinks
// the frame and rider by that much.
import * as THREE from 'three';
import type { Brake, FrameShape, Kit } from '../rules/bikes';
import { C } from '../look/palette';
import { V, rodGeo, roundBox, piece } from './geo';

export interface KitPose { fork: number; rear: number; clampFront: number; clampRear: number; ring: number }
export interface KitRig {
  pose(p: KitPose): { dropFront: number; dropRear: number };
  travel: { fork: number; rear: number }; // drawn travel, model units (0 where rigid)
  painted: THREE.Mesh[]; // moving pieces in the frame color, so a repaint reaches them too
}
// what the rig builds the kit into, and the static geometry the kit hands back to merge into the frame and fork meshes
export interface KitParts {
  chassis: THREE.Group; // the frame: everything that sinks with the rider
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  frame: THREE.BufferGeometry[]; // frame color
  fork: THREE.BufferGeometry[]; // fork metal
}

const STANCHION = 0xc9ccd0, LOWERS = 0x2c2f35, CALIPER = 0xd8342c, ROTOR = 0xb8bcc0, SPRING = 0xffc22e, CAN = 0x3a3d44, RING = 0xff4f9a;
const SIDE = -0.04; // rotors sit on the bike's left, between the hub and the fork leg or stays (legs at ±0.07)
const LEGS = [-0.07, 0.07];

// A pivot: rotate `outer` (at p); children of `inner` use the bike's own coordinates.
function pivot(parent: THREE.Object3D, p: THREE.Vector3): { outer: THREE.Group; inner: THREE.Group } {
  const outer = new THREE.Group(), inner = new THREE.Group();
  outer.position.set(p.x, p.y, 0);
  inner.position.set(-p.x, -p.y, 0);
  outer.add(inner);
  parent.add(outer);
  return { outer, inner };
}
// Re-parent a wheel group without moving it (both parents use the bike's coordinates).
const adopt = (parent: THREE.Object3D, w: THREE.Object3D) => parent.add(w);
const named = <M extends THREE.Object3D>(m: M, name: string): M => ((m.name = name), m);

// A rod from a to b, rebuilt as a unit-length mesh each pose: position, length and direction set by setRod.
function stretchRod(parent: THREE.Object3D, r: number, color: number, z: number[] = [0]): THREE.Mesh {
  const geos = z.map((dz) => new THREE.CylinderGeometry(r, r, 1, 8).translate(0, 0.5, dz));
  return piece(parent, geos, color);
}
const tmpD = new THREE.Vector3();
function setRod(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  tmpD.subVectors(b, a);
  m.position.set(a.x, a.y, 0);
  m.rotation.set(0, 0, Math.atan2(-tmpD.x, tmpD.y));
  m.scale.set(1, tmpD.length(), 1);
}

// A disc: a rotor on the wheel (it spins with it) and a caliper straddling its edge, on the piece the wheel hangs from,
// at `toward` (a unit direction from the axle: behind the fork leg, or between the rear stays).
function disc(wheel: THREE.Object3D, holder: THREE.Object3D, axle: THREE.Vector3, mm: number, scale: number, toward: THREE.Vector3, name: string): THREE.Mesh {
  const r = mm / 2000 / scale;
  named(piece(wheel, [new THREE.CylinderGeometry(r, r, 0.012, 28).rotateX(Math.PI / 2).translate(0, 0, SIDE)], ROTOR), `rotor${name}`);
  const at = V(axle.x + toward.x * r, axle.y + toward.y * r, SIDE - 0.01);
  const cal = named(piece(holder, [roundBox(0.075, 0.1, 0.045, 0.015)], CALIPER), `caliper${name}`);
  cal.position.copy(at);
  cal.rotation.z = Math.atan2(toward.y, toward.x);
  cal.userData.rest = at.z;
  return cal;
}
// Rim brakes: an arm on each fork leg or stay (in line with it, just in front of the fork or behind the seatstays), from
// just below the rim to just above the tire, a pad reaching in to the rim, and the cable across the top over the tire.
// `out` is +1 to sit ahead of the leg (the fork), -1 behind it (the seatstays). Braking squeezes them in (scale z).
function rimArms(holder: THREE.Object3D, axle: THREE.Vector3, along: THREE.Vector3, WR: number, out: number, name: string): THREE.Mesh {
  const off = V(along.y, -along.x, 0).multiplyScalar(0.05 * out); // the leg's radius plus the arm's, sideways from the leg
  const at = (d: number, z: number) => V(axle.x + along.x * d + off.x, axle.y + along.y * d + off.y, z);
  const rim = WR - 0.07, top = WR + 0.1, Z = 0.085;
  const geos = [-1, 1].flatMap((side) => [
    rodGeo(at(rim - 0.05, side * Z), at(top, side * Z), 0.016), // the arm
    rodGeo(at(rim, side * Z), at(rim, side * 0.03), 0.022), // the pad, on the rim
  ]);
  geos.push(rodGeo(at(top, -Z), at(top, Z), 0.009)); // the cable over the tire
  return named(piece(holder, geos, C.black), `rimBrake${name}`);
}

export function buildKit(kit: Kit, f: FrameShape & { wheel: number }, g: KitParts, frameColor: number, scale: number, suspScale = 1): KitRig {
  const WR = f.wheel, AXLE = f.axle;
  const BB = V(f.bb[0], f.bb[1], 0), SEAT = V(f.seat[0], f.seat[1], 0), HT_B = V(f.htBottom[0], f.htBottom[1], 0);
  const FA = V(AXLE, WR, 0), RA = V(-AXLE, WR, 0);
  const drawn = (mm: number) => (mm / 1000) * 0.8 * suspScale / scale;
  const travel = { fork: kit.fork.kind === 'rigid' ? 0 : drawn(kit.fork.travel), rear: kit.rear.design === 'hardtail' ? 0 : drawn(kit.rear.travel) };

  // ---- the fork
  const up = new THREE.Vector3().subVectors(HT_B, FA).normalize(); // along the fork, axle to crown
  const forkLen = HT_B.distanceTo(FA);
  const frontEnd = new THREE.Group(); // slides up the fork axis as it compresses
  g.chassis.add(frontEnd);
  adopt(frontEnd, g.frontWheel);
  let ring: THREE.Mesh | null = null;
  const painted: THREE.Mesh[] = [];
  if (kit.fork.kind === 'rigid') {
    for (const dz of LEGS) g.fork.push(rodGeo(V(HT_B.x, HT_B.y, dz), V(FA.x, FA.y, dz), 0.035));
  } else {
    // the exposed stanchion shows the travel: the lowers stop that far (plus a little) below the crown
    const lowersLen = Math.max(0.12, forkLen - travel.fork - 0.07);
    const seal = FA.clone().addScaledVector(up, lowersLen);
    const lowers: THREE.BufferGeometry[] = [];
    for (const dz of LEGS) {
      g.fork.push(rodGeo(V(HT_B.x, HT_B.y, dz), V(seal.x, seal.y, dz).addScaledVector(up, -0.05), 0.045));
      lowers.push(rodGeo(V(FA.x, FA.y, dz), V(seal.x, seal.y, dz), 0.058));
    }
    const arch = seal.clone().addScaledVector(up, -0.07);
    lowers.push(rodGeo(V(arch.x, arch.y, -0.09), V(arch.x, arch.y, 0.09), 0.026));
    named(piece(frontEnd, lowers, LOWERS), 'forkLowers');
    // the O-ring rides the left stanchion, pushed up by the seal to the deepest hit
    ring = named(piece(g.chassis, [new THREE.TorusGeometry(0.05, 0.012, 6, 16).rotateX(Math.PI / 2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up))], RING), 'oring');
    ring.position.set(seal.x, seal.y, LEGS[0]);
    ring.userData.seal = seal;
  }

  // ---- the rear end
  let swing: { outer: THREE.Group; inner: THREE.Group } | null = null, lever = 1;
  let shock: ReturnType<typeof makeShock> | null = null;
  let extra: (() => void) | null = null;
  const rearHolder = (): THREE.Object3D => swing?.inner ?? g.chassis;
  if (kit.rear.design === 'hardtail') {
    g.frame.push(...LEGS.flatMap((dz) => [rodGeo(V(BB.x, BB.y, dz), V(RA.x, RA.y, dz), 0.025), rodGeo(V(SEAT.x + 0.02, SEAT.y - 0.06, dz), V(RA.x, RA.y, dz), 0.022)]));
  } else {
    const design = kit.rear.design;
    // Each design, a cartoon a kid can tell apart:
    //   singlePivot: a chunky swingarm on one pivot above the bottom bracket, a tall tab on it, the shock to the down tube
    //   linkage: chainstays pivot low by the bottom bracket, the seatstays drive a rocker on the seat tube, the rocker
    //     drives a shock lying along the top of the front triangle
    //   shortLink: the rear triangle hangs on two short links behind the bottom bracket (it swings round a point in
    //     the air, so no pivot is drawn), the shock standing up in front of the seat tube
    const P = design === 'singlePivot' ? BB.clone().add(V(0.08, 0.16, 0)) : design === 'linkage' ? BB.clone().add(V(-0.06, 0.05, 0)) : BB.clone().add(V(0.04, 0.3, 0));
    lever = P.x - RA.x;
    swing = pivot(g.chassis, P);
    named(swing.outer, 'swingarm');
    adopt(swing.inner, g.rearWheel);
    const low = design === 'singlePivot' ? P.clone() : design === 'linkage' ? P.clone() : BB.clone().add(V(-0.13, 0.1, 0));
    const top = design === 'singlePivot' ? P.clone().add(V(-0.22, 0.27, 0)) : SEAT.clone().lerp(BB, design === 'linkage' ? 0.36 : 0.55).add(V(-0.07, 0, 0));
    const fat = design === 'singlePivot' ? 0.036 : 0.026;
    const tri = LEGS.flatMap((dz) => [rodGeo(V(low.x, low.y, dz), V(RA.x, RA.y, dz), fat), rodGeo(V(top.x, top.y, dz), V(RA.x, RA.y, dz), 0.024), rodGeo(V(low.x, low.y, dz), V(top.x, top.y, dz), 0.026)]);
    tri.push(rodGeo(V(top.x, top.y, -0.08), V(top.x, top.y, 0.08), 0.024));
    if (design !== 'shortLink') tri.push(rodGeo(V(P.x, P.y, -0.1), V(P.x, P.y, 0.1), 0.032));
    painted.push(piece(swing.inner, tri, frameColor));
    // a point on the rear triangle, where it is now (bike coordinates)
    const at = new THREE.Vector3();
    const triPoint = (p: THREE.Vector3) => at.copy(p).sub(P).applyAxisAngle(V(0, 0, 1), swing!.outer.rotation.z).add(P);
    if (design === 'singlePivot') {
      shock = makeShock(g.chassis, BB.clone().lerp(HT_B, 0.45), () => triPoint(top));
    } else if (design === 'linkage') {
      const R0 = SEAT.clone().lerp(BB, 0.28);
      const rocker = pivot(g.chassis, R0);
      named(rocker.outer, 'rocker');
      const back = top.clone(), front = R0.clone().add(V(0.2, -0.02, 0));
      piece(rocker.inner, [rodGeo(V(R0.x, R0.y, -0.1), V(R0.x, R0.y, 0.1), 0.03), ...LEGS.flatMap((dz) => [rodGeo(V(back.x, back.y, dz), V(R0.x, R0.y, dz), 0.034), rodGeo(V(R0.x, R0.y, dz), V(front.x, front.y, dz), 0.034), rodGeo(V(back.x, back.y, dz), V(front.x, front.y, dz), 0.02)])], C.black);
      const a0 = Math.atan2(back.y - R0.y, back.x - R0.x);
      const frontNow = new THREE.Vector3();
      extra = () => {
        const t = triPoint(top);
        rocker.outer.rotation.z = Math.atan2(t.y - R0.y, t.x - R0.x) - a0;
      };
      shock = makeShock(g.chassis, BB.clone().lerp(HT_B, 0.66), () => frontNow.copy(front).sub(R0).applyAxisAngle(V(0, 0, 1), rocker.outer.rotation.z).add(R0));
    } else {
      const lowFrame = BB.clone().add(V(0.03, 0.07, 0)), highFrame = SEAT.clone().lerp(BB, 0.62).add(V(0.03, 0, 0));
      const lowTri = low.clone(), highTri = low.clone().lerp(top, 0.45);
      const links = named(new THREE.Group(), 'links');
      g.chassis.add(links);
      const lo = stretchRod(links, 0.042, C.black, LEGS), hi = stretchRod(links, 0.042, C.black, LEGS);
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      extra = () => {
        setRod(lo, lowFrame, a.copy(triPoint(lowTri)));
        setRod(hi, highFrame, b.copy(triPoint(highTri)));
      };
      // the shock stands in front of the seat tube, pushed up by the lower link
      const shockTop = SEAT.clone().lerp(BB, 0.3).add(V(0.1, 0, 0)), linkMid = new THREE.Vector3();
      shock = makeShock(g.chassis, shockTop, () => linkMid.copy(lowFrame).lerp(triPoint(lowTri), 0.6));
    }
    if (shock && kit.rear.shock === 'coil') shock.spring = makeCoil(shock.body);
  }

  // ---- brakes
  const clamps: { m: THREE.Mesh; kind: 'disc' | 'rim'; front: boolean }[] = [];
  const brake = (b: Brake, front: boolean) => {
    if (b === 'none') return;
    const wheel = front ? g.frontWheel : g.rearWheel, holder = front ? frontEnd : rearHolder(), axle = front ? FA : RA;
    const seatstay = new THREE.Vector3().subVectors(SEAT, RA).normalize();
    if (b === 'rim') clamps.push({ m: rimArms(holder, axle, front ? up : seatstay, WR, front ? 1 : -1, front ? 'Front' : 'Rear'), kind: 'rim', front });
    else {
      // front: behind the fork leg (the leg's direction swung back); rear: between the seatstay and the chainstay
      const toward = front ? up.clone().applyAxisAngle(V(0, 0, 1), 0.7) : seatstay.add(new THREE.Vector3().subVectors(BB, RA).normalize()).normalize();
      clamps.push({ m: disc(wheel, holder, axle, b, scale, toward, front ? 'Front' : 'Rear'), kind: 'disc', front });
    }
  };
  brake(kit.brakeFront, true);
  brake(kit.brakeRear, false);

  return {
    travel,
    painted,
    pose(p) {
      // the front wheel and lowers slide up the fork; the frame drops by the vertical part of that
      const df = p.fork * travel.fork;
      frontEnd.position.set(up.x * df, up.y * df, 0);
      const dr = p.rear * travel.rear;
      if (swing) swing.outer.rotation.z = -Math.asin(Math.max(-1, Math.min(1, dr / lever)));
      extra?.();
      if (shock) shock.update();
      if (ring) {
        const seal = ring.userData.seal as THREE.Vector3;
        const d = Math.max(0, p.ring) * travel.fork;
        ring.position.set(seal.x + up.x * d, seal.y + up.y * d, LEGS[0]);
      }
      for (const c of clamps) {
        const k = c.front ? p.clampFront : p.clampRear;
        if (c.kind === 'rim') c.m.scale.z = 1 - 0.35 * k;
        else c.m.position.z = (c.m.userData.rest as number) + 0.015 * k;
      }
      return { dropFront: up.y * df, dropRear: dr };
    },
  };
}

// A shock from a fixed mount to a moving one: the can stays on the mount, the shaft slides out of it to the other eye.
function makeShock(parent: THREE.Object3D, from: THREE.Vector3, to: () => THREE.Vector3) {
  const len0 = from.distanceTo(to());
  const holder = new THREE.Group();
  parent.add(holder);
  const bodyLen = len0 * 0.6;
  const body = named(piece(holder, [new THREE.CylinderGeometry(0.05, 0.05, bodyLen, 12).translate(0, bodyLen / 2, 0), new THREE.SphereGeometry(0.035, 8, 6)], CAN), 'shockBody');
  const shaft = named(piece(holder, [new THREE.CylinderGeometry(0.02, 0.02, 1, 8).translate(0, -0.5, 0), new THREE.SphereGeometry(0.035, 8, 6)], STANCHION), 'shockShaft');
  const s = {
    body, shaft, spring: null as THREE.Mesh | null, from, to,
    update() {
      const t = to();
      tmpD.subVectors(t, from);
      const len = tmpD.length();
      holder.position.set(from.x, from.y, 0);
      holder.rotation.set(0, 0, Math.atan2(-tmpD.x, tmpD.y));
      shaft.position.set(0, len, 0);
      shaft.scale.set(1, Math.max(0.01, len - bodyLen * 0.85), 1);
      if (s.spring) s.spring.scale.set(1, len / len0, 1);
    },
  };
  s.update();
  return s;
}
// A coil spring round the shock: a bright helix that squashes with it.
function makeCoil(body: THREE.Mesh): THREE.Mesh {
  const len = (body.geometry as THREE.BufferGeometry).boundingBox ?? (body.geometry.computeBoundingBox(), body.geometry.boundingBox!);
  const h = len.max.y * 1.35;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2 * 6;
    pts.push(V(Math.cos(a) * 0.07, (i / 80) * h, Math.sin(a) * 0.07));
  }
  const m = named(piece(body.parent!, [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.014, 5)], SPRING), 'shockSpring');
  return m;
}
