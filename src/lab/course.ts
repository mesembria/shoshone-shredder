// The shared pieces the game's two places are built from (src/world/places/): the course's types, the profile tool and
// the extruded dirt features (tabletops, berms, rollers), the jump sizes, boulders, plants you ride into, the pump track,
// the slalom gates and the planks. Jumps run along +x. Lips and highlighted edges are yellow.
import * as THREE from 'three';
import { C } from '../look/palette';
import { mat } from '../look/toyLook';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Surface } from '../world/physics';
import type { Ledge, Trail, Zone } from '../world/trail';
import type { Route } from '../world/route';

export interface Line {
  lip: THREE.Vector3; // where the takeoff ends (or a skinny starts)
  yaw: number; // riding direction
  width: number;
  after: number; // meters past the lip the assist keeps holding the line (skinnies)
  land?: { knuckle: number; length: number; drop: number }; // landing slope: where it starts past the lip, its length, its height
}
export interface Gate { a: THREE.Vector2; b: THREE.Vector2 }
export interface Station { pos: THREE.Vector3; yaw: number; speed?: number } // speed: a push start
export interface Area { x0: number; x1: number; z0: number; z1: number }
// climb (a try-out): where the climb's rules apply, where the gravel is, the ledges' edges and which way each is
// ridden, and the lines across the trail at the bottom of the first pitch and at the top
export interface Climb { area: Zone[]; loose: Zone[]; ledges: Ledge[]; start: Gate; top: Gate }
// Where a place may be dressed (src/look/scenery.ts reads this, never the course's meshes). clearance: metres to the
// nearest thing that must stay clear (a trail edge, a lip, a station, a ring, a feature footprint), up to 14. ground:
// the ground height at (x, z) inside the boundary (the place's own inside the extent, flat 0 between the extent and the boundary). towns and groves: where the prairie dogs and the pine clumps go.
export interface SceneryPlan {
  seed: number;
  extent: { x0: number; x1: number; z0: number; z1: number };
  // where the place ends: the extent plus a margin. A wall stands on it; inside it the visual ground is the collision ground
  bound: { x0: number; x1: number; z0: number; z1: number };
  clearance(x: number, z: number): number;
  towns: { x: number; z: number }[];
  groves: { x: number; z: number; r: number; n: number }[];
  ground(x: number, z: number): number;
}
export interface Course {
  world: THREE.Group; decor: THREE.Object3D[]; lines: Line[]; gates: Gate[]; bumpers: Bumpers; stations: Record<string, Station>; coast: Zone[]; climb: Climb;
  rough: Zone[]; // rough ground: shakes every bike, kicks it sideways above its wobble speed
  // timed runs, keyed by challenge id: ridden across the start line, then the via line if there is one, then the finish,
  // along the route (the trail stretches the run follows, in riding order: src/world/route.ts)
  runs: Record<string, { start: Gate; finish: Gate; via?: Gate; route: Route }>;
  // which place this is, where a ride starts when no station is asked for, and the place's own data
  place: string;
  home: string;
  trails: Record<string, Trail>;
  rings: Record<string, { x: number; z: number }>; // a ring to ride into at each challenge spot
  zones: Record<string, Zone>; // the area to stay in while that spot's challenge runs
  ground?(x: number, z: number): number; // the land's height, where the place is built on a generated hill
  pumpTrack?: PumpTrack; // the pump track's loop, for the lap line (places that have one)
  planks?: Plank[]; // the skinnies, for the plank watch (places that have them)
  scenery: SceneryPlan;
}
export interface PumpTrack { x: number; z: number; R: number; width: number; half: number; bank: number }
// The narrow plank is The Plank's: a gap in the middle (x from gap[0] to gap[1]) to hop out of one manual and into the
// next. The wide one has no gap: practice.
export interface Plank { z: number; width: number; x0: number; x1: number; y: number; gap?: [number, number] }
export interface Slalom { x0: number; step: number; swing: number; count: number; z?: number } // z: the line the gates swing about (0 on the old street)

export const DIRT = 0xb08f68;
const DIRT_DARK = 0x97785a, RED = 0xd9534f, BLUE = 0x3d6fb6;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function mesh(geo: THREE.BufferGeometry, color: number, collide?: Surface, flat = false): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = !flat;
  m.receiveShadow = true;
  if (collide) m.userData.collide = collide;
  return m;
}
export function slab(p: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, y: number, h: number, color: number, collide?: Surface, flat = false): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), color, collide, flat);
  m.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  p.add(m);
  return m;
}
export function post(p: THREE.Object3D, x: number, z: number, h: number, r: number, color: number, collide?: Surface, y = 0): void {
  const m = mesh(new THREE.CylinderGeometry(r, r, h, 8), color, collide);
  m.position.set(x, y + h / 2, z);
  p.add(m);
}
// A boulder: a lumpy stone, partly sunk into the ground at (x, y, z). Its lumps come from its position, so the
// course is the same every time; or from `seed` (0 to 1) when given, so a trail's rocks keep their shapes wherever
// the trail is laid (see trailSeed).
export function rockGeo(x: number, y: number, z: number, r: number, tall = 0.75, seed?: number): THREE.BufferGeometry {
  const k = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, f = seed ?? k - Math.floor(k);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y + r * 0.4, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(f * 0.6, f * 6.28, (1 - f) * 0.5)),
    new THREE.Vector3(1 + 0.2 * f, tall + 0.3 * (1 - f), 1.1 - 0.15 * f),
  );
  return new THREE.DodecahedronGeometry(r, 0).applyMatrix4(m);
}
export function rock(p: THREE.Object3D, x: number, y: number, z: number, r: number, seed?: number): void {
  p.add(mesh(rockGeo(x, y, z, r, 0.75, seed), C.stone, 'rock'));
}

// A banked half-circle turn round (cx, cz): the riding surface runs from R - width/2 to R + width/2, rising
// toward the outside to `bank` meters, then a back slope down to the ground. The bank fades in and out at the
// ends to meet the flat ends of the straights. side +1 turns round the +x end of a loop, -1 the -x end.
export function berm(p: THREE.Object3D, cx: number, cz: number, side: number, R: number, width: number, bank: number, y: number, back = 2.2): void {
  const rIn = R - width / 2, nA = 160, nU = 28, nB = 4, rows = nU + nB + 1;
  const smooth = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nA; i++) {
    const th = (Math.PI * i) / nA;
    const H = bank * smooth(th / 0.9) * smooth((Math.PI - th) / 0.9);
    for (let j = 0; j < rows; j++) {
      const u = j / nU, b = (j - nU) / nB;
      const r = j <= nU ? rIn + u * width : rIn + width + b * back;
      const h = j <= nU ? H * Math.pow(u, 1.5) : H * (1 - b);
      pos.push(cx + side * r * Math.sin(th), y + h + 0.001, cz - side * r * Math.cos(th));
    }
  }
  for (let i = 0; i < nA; i++)
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j, c = a + rows;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  p.add(mesh(geo, DIRT, 'dirt'));
}

// A riding profile: heights h along a run u, built from flats, straight slopes and round transitions.
// Angles in degrees, positive uphill. Concave arcs curve up (the bottom of a ramp); convex arcs curve over (a crest).
export class Profile {
  pts: [number, number][] = [[0, 0]];
  get u() { return this.pts[this.pts.length - 1][0]; }
  get h() { return this.pts[this.pts.length - 1][1]; }
  flat(len: number): this {
    this.pts.push([this.u + len, this.h]);
    return this;
  }
  slopeTo(deg: number, h: number): this {
    this.pts.push([this.u + (h - this.h) / Math.tan((deg * Math.PI) / 180), h]);
    return this;
  }
  concave(from: number, to: number, R: number, step = 0.2): this {
    const a0 = (from * Math.PI) / 180, a1 = (to * Math.PI) / 180;
    const cx = this.u - R * Math.sin(a0), cy = this.h + R * Math.cos(a0);
    const n = Math.max(2, Math.ceil((R * Math.abs(a1 - a0)) / step));
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.pts.push([cx + R * Math.sin(a), cy - R * Math.cos(a)]);
    }
    return this;
  }
  convex(from: number, to: number, R: number, step = 0.2): this {
    const t0 = (-from * Math.PI) / 180, t1 = (-to * Math.PI) / 180;
    const cx = this.u - R * Math.sin(t0), cy = this.h - R * Math.cos(t0);
    const n = Math.max(2, Math.ceil((R * Math.abs(t1 - t0)) / step));
    for (let i = 1; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      this.pts.push([cx + R * Math.sin(t), cy + R * Math.cos(t)]);
    }
    return this;
  }
  // a round-bottomed takeoff from flat ground up to height H, ending at a lip of `lip` degrees
  kick(H: number, lip: number): this {
    return this.concave(0, lip, (H - this.h) / (1 - Math.cos((lip * Math.PI) / 180)));
  }
  // straight down at `deg` to the ground, with a round transition of radius R at the bottom
  landing(deg: number, R: number): this {
    const b = (deg * Math.PI) / 180;
    return this.slopeTo(-deg, R * (1 - Math.cos(b))).concave(-deg, 0, R);
  }
  wave(len: number, height: number, step = 0.04): this {
    const u0 = this.u, h0 = this.h, n = Math.ceil(len / step);
    for (let i = 1; i <= n; i++) this.pts.push([u0 + (len * i) / n, h0 + (height * (1 - Math.cos((2 * Math.PI * i) / n))) / 2]);
    return this;
  }
}

// The profile's height at run u (the top of a step, at the step itself). u never decreases along pts, so the last
// segment that starts at or before u is found by bisection (this runs hundreds of thousands of times building a hill).
export function heightAt(prof: Profile, u: number): number {
  const p = prof.pts;
  let lo = 0, hi = p.length - 1; // find the largest j in [0, hi) with p[j][0] <= u; none means u is before the profile
  if (hi < 1 || p[0][0] > u) return p[0][1];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p[mid][0] <= u) lo = mid; else hi = mid;
  }
  const [u0, h0] = p[lo], [u1, h1] = p[lo + 1];
  return u1 === u0 ? h1 : h0 + ((h1 - h0) * Math.min(1, (u - u0) / (u1 - u0)));
}

// Extrude a profile across `width`, starting at (x, y, z) and running toward yaw (0 = +x).
export function extrude(p: THREE.Object3D, prof: Profile, x: number, y: number, z: number, yaw: number, width: number, color: number, collide: Surface): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(prof.pts[0][0], 0);
  for (const [u, h] of prof.pts) shape.lineTo(u, Math.max(h, 0.001));
  shape.lineTo(prof.u, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -width / 2);
  const m = mesh(geo, color, collide);
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  p.add(m);
  return m;
}
// a yellow bar across the lip, so takeoffs read from far away
export function lipBar(p: THREE.Object3D, x: number, y: number, z: number, width: number): void {
  const m = mesh(new THREE.CylinderGeometry(0.06, 0.06, width, 8).rotateX(Math.PI / 2), C.lip);
  m.position.set(x - 0.04, y - 0.03, z);
  p.add(m);
}

interface JumpSize { H: number; lip: number; table: number; landDeg: number; landR: number; width: number }
export const JUMPS: Record<'S' | 'M' | 'L' | 'H2' | 'XL', JumpSize> = {
  S: { H: 0.7, lip: 26, table: 3.6, landDeg: 24, landR: 3, width: 3 },
  M: { H: 1.2, lip: 28, table: 7.5, landDeg: 26, landR: 4, width: 3.5 },
  L: { H: 1.8, lip: 30, table: 11, landDeg: 28, landR: 5, width: 4 },
  H2: { H: 1.4, lip: 30, table: 8, landDeg: 26, landR: 5, width: 4.5 }, // the hill line's second jump: climbing a taller one costs too much speed
  XL: { H: 2.4, lip: 38, table: 11, landDeg: 34, landR: 6, width: 4.5 }, // big enough for a perfect-popped enduro backflip
};

// A tabletop: takeoff, flat table, landing. Returns the far end's x.
export function tabletop(p: THREE.Object3D, lines: Line[], j: JumpSize, x: number, y: number, z: number): number {
  const prof = new Profile().kick(j.H, j.lip);
  const lipU = prof.u;
  prof.flat(j.table);
  const knuckle = prof.u;
  prof.landing(j.landDeg, j.landR);
  const landLen = prof.u - knuckle;
  prof.flat(0.5);
  extrude(p, prof, x, y, z, 0, j.width, DIRT, 'dirt');
  lipBar(p, x + lipU, y + j.H, z, j.width);
  lines.push({ lip: V(x + lipU, y + j.H, z), yaw: 0, width: j.width, after: 0, land: { knuckle: knuckle - lipU, length: landLen, drop: j.H } });
  return x + prof.u;
}

// Plants you ride into. Loose ones (the old park's bushes) burst as you ride through and grow back after a few seconds;
// firm ones (the clumps that hold a trail's edge) stay put and stop you like a rock does: an invisible open-topped
// collider round each, so the body bumps its sides while a ray looking down still sees the grass it grows in. Either way
// update() reports where a plant was touched (once a touch), for the burst of leaves and the slowdown.
export type BumperKind = 'yucca' | 'cactus' | 'bush';
// y: the height it stands at, where that isn't the land's (a plant beside a trail that runs along the top of a bank stands
// at the trail's height, as the old rocks did)
export interface BumperSpot { x: number; z: number; r: number; kind: BumperKind; y?: number }
export interface Bumpers {
  meshes: THREE.InstancedMesh[]; // one per kind of plant, for the decor
  solid: THREE.Mesh | null; // the firm plants' colliders, for the world (drawn by nothing)
  spots: readonly BumperSpot[];
  firm: boolean;
  update(dt: number, at: THREE.Vector3): THREE.Vector3 | null;
}
const hidden = new THREE.MeshBasicMaterial({ visible: false });
// each kind about one unit round its middle, standing on y 0
const PLANTS: Record<BumperKind, { geo: () => THREE.BufferGeometry; color: number }> = {
  bush: { geo: () => new THREE.IcosahedronGeometry(1, 1), color: C.shrub },
  // a yucca: a burst of stiff spikes
  yucca: {
    color: 0x6f7f3a,
    geo: () => mergeGeometries(Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + (i % 3) * 0.4, tilt = 0.3 + (i % 4) * 0.25, h = 0.9 + (i % 3) * 0.2;
      return new THREE.ConeGeometry(0.07, h, 3, 1, true).translate(0, h / 2, 0).rotateZ(tilt).rotateY(a).toNonIndexed();
    })),
  },
  // prickly pear: a stack of flat pads
  cactus: {
    color: 0x7a9440,
    geo: () => mergeGeometries([[0, 0.3, 0, 0, 1], [0.4, 0.62, -0.5, 0.4, 0.85], [-0.38, 0.6, 0.5, -0.3, 0.8], [0.05, 0.9, 0.1, 1.4, 0.7], [0.1, 0.35, 0.2, 1.7, 0.8]]
      .map(([x, y, rz, ry, k]) => new THREE.IcosahedronGeometry(1, 0).scale(0.45 * k, 0.38 * k, 0.11).rotateZ(rz).rotateY(ry).translate(x, y, 0))), // (an icosahedron has no index)
  },
};
export function bumpers(spots: BumperSpot[], o: { firm?: boolean; ground?: (x: number, z: number) => number } = {}): Bumpers {
  const firm = !!o.firm, ground = o.ground ?? (() => 0);
  const kinds = (['bush', 'yucca', 'cactus'] as const).filter((k) => spots.some((s) => s.kind === k));
  const meshes = kinds.map((k) => {
    const m = new THREE.InstancedMesh(PLANTS[k].geo(), mat(PLANTS[k].color), spots.filter((s) => s.kind === k).length);
    m.castShadow = true;
    return m;
  });
  const slot = spots.map((s) => ({ mesh: meshes[kinds.indexOf(s.kind)], i: 0 }));
  const count = new Map<THREE.InstancedMesh, number>();
  for (const sl of slot) { sl.i = count.get(sl.mesh) ?? 0; count.set(sl.mesh, sl.i + 1); }
  const ys = spots.map((s) => s.y ?? ground(s.x, s.z));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  // k: how grown it is (a burst bush shrinks to nothing and grows back)
  const place = (i: number, k: number) => {
    const s = spots[i], { mesh, i: n } = slot[i];
    if (s.kind === 'bush') mesh.setMatrixAt(n, m.compose(pos.set(s.x, ys[i] + s.r * 0.75 * k, s.z), q.identity(), sc.set(s.r * k, 0.8 * s.r * k, s.r * k)));
    else mesh.setMatrixAt(n, m.compose(pos.set(s.x, ys[i], s.z), q.setFromAxisAngle(up, (s.x * 7.3 + s.z * 3.1) % 6.28), sc.setScalar(s.r * k)));
  };
  spots.forEach((_, i) => place(i, 1));
  let solid: THREE.Mesh | null = null;
  if (firm && spots.length) {
    solid = new THREE.Mesh(mergeGeometries(spots.map((s, i) => new THREE.CylinderGeometry(s.r, s.r, 1.2, 8, 1, true).translate(s.x, ys[i] + 0.4, s.z).toNonIndexed())), hidden);
    solid.userData.collide = 'rock';
  }
  const gone = spots.map(() => 0), touching = spots.map(() => false);
  // which way the rider is going (from where they were last frame), for the firm plants' reach
  const last = new THREE.Vector3(NaN, 0, 0), dir = new THREE.Vector2();
  return {
    meshes, solid, spots, firm,
    update(dt, at) {
      let hit: THREE.Vector3 | null = null, moved = false;
      if (firm) {
        const dx = at.x - last.x, dz = at.z - last.z, d = Math.hypot(dx, dz);
        if (d > 1e-4) dir.set(dx / d, dz / d);
        last.copy(at);
      }
      for (let i = 0; i < spots.length; i++) {
        const { x, z, r } = spots[i], low = at.y - ys[i] < 1.4; // not flying over it
        if (firm) {
          // the body meets the collider about 0.3 m out beside it and 0.75 m out head on: reach that far ahead of the
          // rider, and only body-width (and a graze) to the sides and behind
          const ox = x - at.x, oz = z - at.z, ahead = ox * dir.x + oz * dir.y, beside = Math.abs(ox * dir.y - oz * dir.x);
          const touch = low && (dir.lengthSq() > 0 ? beside < r + 0.35 && ahead > -(r + 0.35) && ahead < r + 0.8 : Math.hypot(ox, oz) < r + 0.35);
          gone[i] = Math.max(0, gone[i] - dt);
          if (touch && !touching[i] && gone[i] <= 0) {
            gone[i] = 0.5;
            hit = new THREE.Vector3(x, ys[i] + 0.6, z);
          }
          touching[i] = touch;
        } else if (gone[i] > 0) {
          gone[i] = Math.max(0, gone[i] - dt);
          place(i, gone[i] < 1 ? 1 - gone[i] : 0);
          moved = true;
        } else if (Math.hypot(at.x - x, at.z - z) < r + 0.35 && low) {
          gone[i] = 6;
          place(i, 0);
          moved = true;
          hit = new THREE.Vector3(x, ys[i] + 0.6, z);
        }
      }
      if (moved || !firm) for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
      return hit;
    },
  };
}

// The pump track loop (two straights of rollers joined by berms) and the two skinnies, shared with the game's
// lap line and plank checks.
// Cone Zone's slalom on the street: gate i at x0 + i * step, swinging from side to side (z = ±swing). Ten close gates
// with a big swing so quick turning adds up, and bikes and riding separate (Nov 7; it was six gates 8 m apart, ±2 m)
export const SLALOM: Slalom = { x0: -50, step: 7, swing: 2, count: 10 };
export const PUMP_TRACK: PumpTrack = { x: 0, z: 90, R: 5.5, width: 3.6, half: 16, bank: 1.3 };
// The narrow plank is The Plank's: a gap in the middle (x from gap[0] to gap[1]) to hop out of one manual and into the
// next. The wide one has no gap: practice.
export const PLANKS: Plank[] = [
  { z: 56, width: 0.8, x0: -18.5, x1: -6.5, y: 0.4, gap: [-13.4, -11.6] }, // the top: a short ramp up before x0 and down after x1
  { z: 61, width: 1.4, x0: -18.5, x1: -6.5, y: 0.4 },
];

// The pump track: two straights of six rollers joined by banked turns, on a dirt pad where pedaling is off
export function pumpTrackGeo(w: THREE.Object3D, PT: PumpTrack, pad: Area): void {
  slab(w, pad.x0, pad.x1, pad.z0, pad.z1, 0, 0.02, DIRT_DARK, 'dirt', true);
  for (const [z, yaw, x0] of [[PT.z - PT.R, 0, PT.x - PT.half], [PT.z + PT.R, Math.PI, PT.x + PT.half]]) {
    const rollers = new Profile().flat(1);
    for (let i = 0; i < 6; i++) rollers.wave(5, 0.5);
    rollers.flat(1);
    extrude(w, rollers, x0, 0.02, z, yaw, PT.width, DIRT, 'dirt');
  }
  berm(w, PT.x + PT.half, PT.z, 1, PT.R, PT.width, PT.bank, 0.02);
  berm(w, PT.x - PT.half, PT.z, -1, PT.R, PT.width, PT.bank, 0.02);
}

// Cone Zone's gates: gate i at x0 + i * step, swinging from side to side about z
export function slalomGates(w: THREE.Object3D, gates: Gate[], S: Slalom): void {
  for (let i = 0; i < S.count; i++) {
    const x = S.x0 + i * S.step, z = (S.z ?? 0) + (i % 2 ? -S.swing : S.swing), color = i % 2 ? BLUE : RED;
    for (const dz of [-1.2, 1.2]) post(w, x, z + dz, 1.0, 0.07, color, 'wall', 0.04);
    gates.push({ a: new THREE.Vector2(x, z - 1.2), b: new THREE.Vector2(x, z + 1.2) });
  }
}

// The skinnies: ride the narrow plank without falling off
export function planks(w: THREE.Object3D, lines: Line[], list: Plank[]): void {
  for (const { z, width: wd, x0, x1, y, gap } of list) {
    // the plank's top runs in pieces between its ends and either side of a gap; a ramp up onto the first, down off the last
    const tops: [number, number][] = gap ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]];
    tops.forEach(([a, b], i) => {
      const piece = new Profile();
      piece.pts[0] = [0, i === 0 ? 0 : y];
      if (i === 0) piece.pts.push([1.5, y]);
      piece.pts.push([piece.u + b - a, y]);
      if (i === tops.length - 1) piece.pts.push([piece.u + 1.5, 0]);
      extrude(w, piece, i === 0 ? a - 1.5 : a, 0, z, 0, wd, C.wood, 'ramp');
      for (const s of [-1, 1]) slab(w, a, b, z + s * (wd / 2 - 0.03) - 0.03, z + s * (wd / 2 - 0.03) + 0.03, y, 0.015, C.lip);
    });
    lines.push({ lip: V(x0, y, z), yaw: 0, width: wd, after: (gap ? gap[0] : x1) - x0 });
    if (gap) {
      for (const gx of gap) lipBar(w, gx + (gx === gap[0] ? 0 : 0.08), y + 0.02, z, wd);
      lines.push({ lip: V(gap[0], y, z), yaw: 0, width: wd, after: x1 - gap[1] });
    }
  }
}
