// The rider and bike you see. It reads BikeState and never changes it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BikeSpec, FrameShape } from '../rules/bikes';
import type { Tumble } from '../world/physics';
import type { BikeState } from './controller';
import { C } from '../look/palette';
import { mat } from '../look/toyLook';

// Modeled for a 0.36 m wheel, then scaled to each bike, so the smaller trail bike gets a smaller rider too. A bike
// can instead set its own rider scale and frame shape: the dirt jumper and enduro carry the same rider on very
// different frames, and the rider holds the bars wherever they are.
export const RIG_WHEEL = 0.36;
const UP = new THREE.Vector3(0, 1, 0);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const DEFAULT_FRAME: FrameShape = {
  axle: 0.58, bb: [-0.04, 0.33], seat: [-0.27, 0.9], htTop: [0.36, 0.92], htBottom: [0.44, 0.72], bar: [0.42, 1.04], barHalf: 0.34, fork: 'plain', shock: false,
};
export const riderScaleOf = (spec: BikeSpec): number => spec.riderScale ?? spec.wheelRadius / RIG_WHEEL;
// The bike's shape in model units, with its wheel radius (model units too).
export function frameOf(spec: BikeSpec): FrameShape & { wheel: number } {
  return { ...DEFAULT_FRAME, ...spec.frame, wheel: spec.wheelRadius / riderScaleOf(spec) };
}
const HIP = V(-0.2, 0.98, 0), SHO = V(0.08, 1.42, 0), HEAD = V(0.17, 1.6, 0);
export const THIGH = 0.42, SHIN = 0.44;
const CRANK = 0.17;

export interface RiderRig {
  root: THREE.Group;
  update(s: BikeState, dt: number, crouching: boolean): void;
  land(strength: number): void;
  detach(t: Tumble, scene: THREE.Scene): void;
  followTumble(t: Tumble): void;
  reattach(): void;
  setColor(color: number): void; // repaints the frame only
  setRiderVisible(v: boolean): void; // hides the rider's meshes; the bike and anchors stay
  standPose(): void; // the stopped pose at once: one shoe on the floor, the bike leaning onto it
  anchors(): Record<AnchorName, THREE.Object3D>; // markers on the bike's parts, so they follow lean and spin
}
export type AnchorName = 'fork' | 'frontTire' | 'rearHub' | 'bars' | 'cranks';

// Two-bone leg: where the knee goes for a hip at (hx, hy) and a foot at (px, py), knee bent forward.
export function kneeAt(hx: number, hy: number, px: number, py: number, a = THIGH, b = SHIN): [number, number] {
  const dx = px - hx, dy = py - hy;
  const d = Math.min(Math.hypot(dx, dy), a + b - 1e-3);
  const ang = Math.atan2(dy, dx) + Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  return [hx + a * Math.cos(ang), hy + a * Math.sin(ang)];
}

// The same in 3D, for a foot off to the side (a foot down): the knee bends forward, square to the hip-to-foot line.
// A foot out of reach is pulled in along that line, so the leg never stretches. Writes the foot it used back into f.
const legDir = new THREE.Vector3(), bendDir = new THREE.Vector3();
export function kneeAt3(h: THREE.Vector3, f: THREE.Vector3, out: THREE.Vector3, a = THIGH, b = SHIN): THREE.Vector3 {
  legDir.subVectors(f, h);
  const d = Math.min(legDir.length(), a + b - 1e-3);
  legDir.normalize();
  f.copy(h).addScaledVector(legDir, d);
  const along = (a * a + d * d - b * b) / (2 * d), up = Math.sqrt(Math.max(0, a * a - along * along));
  bendDir.set(1, 0, 0).addScaledVector(legDir, -legDir.x).normalize();
  return out.copy(h).addScaledVector(legDir, along).addScaledVector(bendDir, up);
}

function rodGeo(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  const mid = a.clone().addScaledVector(dir, 0.5);
  return g.translate(mid.x, mid.y, mid.z);
}
const roundBox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, r);

// Static pieces that share a color merge into one mesh, to keep draw calls low on the iPad.
// RoundedBoxGeometry has no index while the built-in shapes do, so merge everything unindexed.
function piece(parent: THREE.Object3D, geos: THREE.BufferGeometry[], color: number): THREE.Mesh {
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true;
  parent.add(m);
  return m;
}

function wheel(parent: THREE.Object3D, x: number, r: number): THREE.Group {
  const w = new THREE.Group();
  w.position.set(x, r, 0);
  parent.add(w);
  piece(w, [new THREE.TorusGeometry(r, 0.065, 8, 28)], C.tire);
  const metal: THREE.BufferGeometry[] = [new THREE.TorusGeometry(r - 0.07, 0.018, 6, 28)];
  for (let i = 0; i < 3; i++) metal.push(new THREE.BoxGeometry(2 * (r - 0.08), 0.025, 0.02).rotateZ((i * Math.PI) / 3));
  piece(w, metal, 0xb8bcc0);
  return w;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function createRider(bike: BikeSpec, opts: { rider?: boolean } = {}): RiderRig {
  const f = frameOf(bike), WR = f.wheel, AXLE = f.axle;
  const P = (p: [number, number], z = 0) => V(p[0], p[1], z);
  const BB = P(f.bb), SEAT = P(f.seat), HT_T = P(f.htTop), HT_B = P(f.htBottom), BAR = P(f.bar);
  const root = new THREE.Group();
  root.scale.setScalar(riderScaleOf(bike));
  const pitchG = new THREE.Group(); // slope, about the middle of the bike
  const manualG = new THREE.Group(); // manual, about the rear axle
  const body = new THREE.Group(); // lean, tabletop and landing squash
  manualG.position.x = -AXLE;
  body.position.x = AXLE;
  root.add(pitchG);
  pitchG.add(manualG);
  manualG.add(body);
  const bikePart = new THREE.Group();
  const riderPart = new THREE.Group();
  body.add(bikePart, riderPart);
  // the rider is built for the trail bike's bars; on another frame the whole rider moves with the bars
  const rider = new THREE.Group();
  rider.position.set(BAR.x - DEFAULT_FRAME.bar[0], BAR.y - DEFAULT_FRAME.bar[1], 0);
  if (opts.rider !== false) riderPart.add(rider);

  // the bike
  const wheels = [wheel(bikePart, -AXLE, WR), wheel(bikePart, AXLE, WR)];
  const frame = [rodGeo(BB, HT_B, 0.045), rodGeo(SEAT, HT_T, 0.04), rodGeo(BB, SEAT, 0.042), rodGeo(HT_B, HT_T, 0.05)];
  const fork: THREE.BufferGeometry[] = [];
  for (const dz of [-0.07, 0.07]) {
    frame.push(rodGeo(V(BB.x, BB.y, dz), V(-AXLE, WR, dz), 0.025), rodGeo(V(SEAT.x + 0.02, SEAT.y - 0.06, dz), V(-AXLE, WR, dz), 0.022));
    const crown = V(HT_B.x, HT_B.y, dz), axle = V(AXLE, WR, dz);
    if (f.fork === 'travel') {
      // fat stanchions down to the lowers, and a brace across the top of the lowers
      const knee = crown.clone().lerp(axle, 0.5);
      fork.push(rodGeo(crown, knee, 0.05), rodGeo(knee, axle, 0.038));
    } else fork.push(rodGeo(crown, axle, 0.035));
  }
  if (f.fork === 'travel') {
    const k = HT_B.clone().lerp(V(AXLE, WR, 0), 0.5);
    fork.push(rodGeo(V(k.x, k.y, -0.08), V(k.x, k.y, 0.08), 0.022));
  }
  const frameMesh = piece(bikePart, frame, bike.frameColor);
  piece(bikePart, fork, 0xc9ccd0);
  if (f.shock) piece(bikePart, [rodGeo(BB.clone().lerp(SEAT, 0.5), SEAT.clone().lerp(HT_T, 0.35), 0.045)], 0xffc22e);
  piece(bikePart, [rodGeo(HT_T, BAR, 0.03), rodGeo(P(f.bar, -f.barHalf), P(f.bar, f.barHalf), 0.022), roundBox(0.28, 0.07, 0.13, 0.03).translate(SEAT.x - 0.02, SEAT.y + 0.035, 0)], C.black);
  const crank = new THREE.Group();
  crank.position.copy(BB);
  bikePart.add(crank);
  const marker = (parent: THREE.Object3D, p: THREE.Vector3) => { const o = new THREE.Object3D(); o.position.copy(p); parent.add(o); return o; };
  const anchorSet: Record<AnchorName, THREE.Object3D> = {
    fork: marker(bikePart, HT_B.clone().lerp(V(AXLE, WR, 0), 0.4)),
    frontTire: marker(wheels[1], V(WR, 0, 0)), // on the wheel, so it spins
    rearHub: marker(wheels[0], V(0, 0, 0)),
    bars: marker(bikePart, BAR.clone()),
    cranks: marker(crank, V(0, 0, 0)),
  };
  piece(crank, [-1, 1].map((s) => new THREE.BoxGeometry(0.04, CRANK, 0.03).translate(0, s * CRANK / 2, s * 0.09)), C.black);

  // the rider
  const torsoGeo = roundBox(0.26, 0.5, 0.36, 0.09).rotateZ(-Math.atan2(SHO.x - HIP.x, SHO.y - HIP.y));
  const mid = HIP.clone().lerp(SHO, 0.5);
  piece(rider, [torsoGeo.translate(mid.x, mid.y, mid.z)], C.jersey);
  piece(rider, [rodGeo(V(SHO.x + 0.03, SHO.y - 0.02, 0), V(HEAD.x - 0.03, HEAD.y - 0.1, 0), 0.06), new THREE.SphereGeometry(0.16, 18, 14).translate(HEAD.x, HEAD.y, HEAD.z)], C.skin);
  for (const z of [-0.058, 0.058]) piece(rider, [new THREE.SphereGeometry(0.024, 8, 6).translate(HEAD.x + 0.148, HEAD.y + 0.012, z)], C.black);
  // hair shows only as a band at the back and sides, under the helmet rim
  piece(rider, [new THREE.SphereGeometry(0.168, 18, 6, -Math.PI / 2, Math.PI, 0.42 * Math.PI, 0.33 * Math.PI).translate(HEAD.x, HEAD.y, HEAD.z)], C.hair);
  // helmet: a dome tipped up at the front, so it sits above the eyes and comes down over the back of the head
  const dome = new THREE.SphereGeometry(0.19, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(0.3).translate(HEAD.x - 0.005, HEAD.y + 0.012, 0);
  piece(rider, [dome, roundBox(0.11, 0.03, 0.28, 0.012).rotateZ(-0.12).translate(HEAD.x + 0.17, HEAD.y + 0.075, 0)], C.helmet);
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(SHO.x, SHO.y - 0.04, s * 0.17);
    rider.add(g);
    const elbow = V(0.16, -0.2, s * 0.09), hand = V(0.34, -0.33, s * 0.12);
    piece(g, [rodGeo(V(0, 0, 0), elbow, 0.05)], C.jersey);
    piece(g, [rodGeo(elbow, hand, 0.045)], C.skin);
    piece(g, [new THREE.SphereGeometry(0.05, 10, 8).translate(hand.x, hand.y, hand.z)], C.black);
    return { s, g };
  });
  const limb = (color: number, r: number) => piece(rider, [new THREE.CylinderGeometry(r, r, 1, 8)], color);
  const legs = [-1, 1].map((s) => ({ s, thigh: limb(C.shorts, 0.065), shin: limb(C.skin, 0.05), shoe: piece(rider, [roundBox(0.18, 0.08, 0.1, 0.03)], C.black) }));
  legs.forEach((L, i) => ((L.thigh.name = `thigh${i}`), (L.shin.name = `shin${i}`), (L.shoe.name = `shoe${i}`)));
  // Seeing stars: three little stars circle the helmet
  const stars = new THREE.Group();
  stars.position.set(HEAD.x, HEAD.y + 0.32, 0);
  for (let i = 0; i < 3; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), mat(0xffd84a));
    star.position.set(Math.cos((i * 2 * Math.PI) / 3) * 0.26, 0, Math.sin((i * 2 * Math.PI) / 3) * 0.26);
    stars.add(star);
  }
  stars.visible = false;
  rider.add(stars);

  const ta = new THREE.Vector3(), tb = new THREE.Vector3();
  function setLimb(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    ta.subVectors(b, a);
    m.position.copy(a).addScaledVector(ta, 0.5);
    m.scale.set(1, ta.length(), 1);
    m.quaternion.setFromUnitVectors(UP, ta.normalize());
  }
  // A foot down: the first leg comes off its pedal to the ground just outside the hip, and the bike leans over onto it
  // (by DAB_LEAN, just enough on this frame for the leg to reach). Worked out in the body's frame, which leans by lean.
  const DAB_OUT = 0.1, DAB_AHEAD = 0.1, FOOT_Y = 0.04, hipW = new THREE.Vector3(), footW = new THREE.Vector3();
  // The tire's tread sits TIRE below the wheel's rim circle, so standing still the body is raised by that much to put
  // the tread on the floor; the floor is then lower in the body's frame.
  const TIRE = 0.065;
  let lift0 = 0;
  const dabSide = legs[0].s;
  function groundFoot(lean: number, lift: number, out: THREE.Vector3): THREE.Vector3 {
    const c = Math.cos(lean), sn = Math.sin(lean);
    const hx = HIP.x + rider.position.x, hy = HIP.y + rider.position.y + lift, hz = dabSide * 0.13;
    // the hip as it sits once leaned, then the ground under it, a little out and ahead, back into the body's frame
    const gz = hy * sn + hz * c + dabSide * DAB_OUT;
    return out.set(hx + DAB_AHEAD, (FOOT_Y - lift0) * c + gz * sn, -(FOOT_Y - lift0) * sn + gz * c);
  }
  const leanFor = (): number => {
    for (let lean = 0; lean < 0.6; lean += 0.01) {
      const hip = hipW.set(HIP.x + rider.position.x, HIP.y + rider.position.y, dabSide * 0.13);
      if (groundFoot(dabSide * lean, 0, footW).distanceTo(hip) < 0.97 * (THIGH + SHIN)) return lean;
    }
    return 0.6;
  };
  const DAB_LEAN = leanFor(), STAND_LEAN = (lift0 = TIRE, leanFor()); // standing, the floor is lower, so it leans further
  lift0 = 0;
  const hip = new THREE.Vector3(), foot = new THREE.Vector3(), knee = new THREE.Vector3();
  // footDown 0..1: the first leg swings off its pedal to the ground beside the bike (a dab, or resting)
  function poseLegs(theta: number, footDown = 0): void {
    crank.rotation.z = theta;
    const lift = riderPart.position.y; // feet stay on the pedals when the rider crouches
    for (const L of legs) {
      // pedals turn round the frame's bottom bracket; the legs work in the rider's own (moved) frame
      foot.set(BB.x - rider.position.x - L.s * CRANK * Math.sin(theta), BB.y - rider.position.y + L.s * CRANK * Math.cos(theta) - lift, L.s * 0.13);
      if (L === legs[0] && footDown > 0) {
        groundFoot(body.rotation.x, lift, footW).sub(rider.position);
        footW.y -= lift;
        foot.lerp(footW, footDown);
      }
      hip.set(HIP.x, HIP.y, L.s * 0.13);
      kneeAt3(hip, foot, knee);
      setLimb(L.thigh, hip, knee);
      setLimb(L.shin, knee, foot);
      L.shoe.position.set(foot.x + 0.03, foot.y + 0.02, foot.z);
    }
  }
  poseLegs(0);

  const pose = { pitch: 0, manual: 0, lean: 0, table: 0, arms: 0, crouch: 0, squash: 0, squashV: 0, kick: 0, foot: 0 };
  let clock = 0, crankA = 0, lastYaw: number | null = null;
  const tumbleRef = { bike: { off: new THREE.Vector3(), q: new THREE.Quaternion() }, rider: { off: new THREE.Vector3(), q: new THREE.Quaternion() } };
  const qb = new THREE.Quaternion();
  let own: THREE.MeshStandardMaterial | null = null;

  return {
    root,
    update(s, dt, crouching) {
      if (lift0) body.position.y = lift0 = 0; // the game takes over from a stand pose
      const yawRate = lastYaw === null || dt <= 0 ? 0 : wrap(s.yaw - lastYaw) / dt;
      lastYaw = s.yaw;
      const ease = (cur: number, target: number, rate: number) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
      const lab = s as BikeState & Partial<{ dab: number; resting: boolean; energy: number; wobble: number }>;
      clock += dt;
      // in a skid the rear wheel swings out, so the nose points further into the turn
      pose.kick = ease(pose.kick, s.skidding ? clamp(yawRate * 0.22, -0.55, 0.55) : 0, 10);
      root.position.copy(s.pos);
      // a speed wobble: the front swings side to side, faster and wider as it builds
      root.rotation.y = s.yaw + pose.kick + (lab.wobble ?? 0) * 0.14 * Math.sin(clock * 26);
      pose.pitch = ease(pose.pitch, s.pitch, 25);
      pose.manual = ease(pose.manual, s.manual > 0 ? 0.42 : 0, 10);
      pose.lean = ease(pose.lean, s.grounded ? clamp((-yawRate * s.speed) / 20, -0.45, 0.45) : 0, 8);
      pose.table = ease(pose.table, s.trick?.id === 'tabletop' ? 1 : 0, 14);
      pose.arms = ease(pose.arms, s.trick?.id === 'nohander' ? 1 : 0, 14);
      pose.crouch = ease(pose.crouch, crouching && s.grounded ? 1 : 0, 16);
      // the landing squash is a stiff spring: step it in small slices so a slow frame can't blow it up
      for (let left = dt; left > 1e-6; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        pose.squashV += (-180 * pose.squash - 12 * pose.squashV) * h;
        pose.squash = clamp(pose.squash + pose.squashV * h, -0.6, 0.6);
      }
      pitchG.rotation.z = pose.pitch;
      manualG.rotation.z = pose.manual;
      body.rotation.x = pose.lean + pose.table + dabSide * DAB_LEAN * pose.foot; // a foot down leans the bike onto it
      body.scale.set(1 + pose.squash * 0.5, 1 - pose.squash, 1 + pose.squash * 0.5);
      // winded after a crash, or nearly out of energy: the rider pants
      const panting = s.winded > 0 || (lab.energy ?? 1) < 0.2;
      riderPart.position.y = -0.12 * pose.crouch + (panting ? 0.025 * Math.sin(clock * 14) : 0);
      pose.foot = ease(pose.foot, s.grounded && ((lab.dab ?? 0) > 0 || lab.resting) ? 1 : 0, 12);
      for (const a of arms) a.g.rotation.set(a.s * 0.5 * pose.arms, 0, 2.1 * pose.arms);
      const roll = (s.speed * dt) / bike.wheelRadius;
      for (const w of wheels) w.rotation.z -= roll;
      if (s.grounded && s.speed > 0.3) crankA -= roll / 2.3;
      poseLegs(crankA, pose.foot);
      stars.visible = s.stars > 0;
      stars.rotation.y += dt * 5;
    },
    land(strength) {
      pose.squashV += 2.6 * clamp(strength, 0, 1.5);
    },
    detach(t, scene) {
      for (const [obj, b, ref] of [[bikePart, t.bike, tumbleRef.bike], [riderPart, t.rider, tumbleRef.rider]] as const) {
        scene.attach(obj);
        const p = b.translation();
        ref.off.set(obj.position.x - p.x, obj.position.y - p.y, obj.position.z - p.z);
        ref.q.copy(obj.quaternion);
      }
    },
    followTumble(t) {
      for (const [obj, b, ref] of [[bikePart, t.bike, tumbleRef.bike], [riderPart, t.rider, tumbleRef.rider]] as const) {
        const p = b.translation(), r = b.rotation();
        qb.set(r.x, r.y, r.z, r.w);
        obj.position.copy(ref.off).applyQuaternion(qb).add(tb.set(p.x, p.y, p.z));
        obj.quaternion.copy(qb).multiply(ref.q);
      }
    },
    setColor(color) {
      // materials are shared by color, so the frame takes its own before changing
      const m = frameMesh.material as THREE.MeshStandardMaterial;
      if (!own) frameMesh.material = (own = m.clone());
      own.color.set(color);
    },
    setRiderVisible(v) {
      rider.visible = v;
    },
    standPose() {
      lift0 = TIRE;
      body.position.y = TIRE;
      pose.foot = 1;
      pose.lean = pose.table = pose.crouch = 0;
      riderPart.position.y = 0;
      body.rotation.x = dabSide * STAND_LEAN;
      poseLegs(crankA, 1);
    },
    anchors: () => anchorSet,
    reattach() {
      for (const obj of [bikePart, riderPart]) {
        body.add(obj);
        obj.position.set(0, 0, 0);
        obj.quaternion.identity();
        obj.scale.set(1, 1, 1);
      }
      pose.squash = pose.squashV = 0;
    },
  };
}
