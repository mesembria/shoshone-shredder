// The home street, the house and Indian Peaks Trail West Park, ported from the look test.
// Every mesh a bike can touch carries userData.collide: 'ground' | 'grass' | 'tallgrass' | 'dirt' | 'ramp' | 'wall' | 'rail'.
// Layout is approximate; Phase 1 replaces it with map data.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../look/palette';
import { mat } from '../look/toyLook';
import type { Surface } from './physics';

interface Opt { r?: number; ry?: number; kind?: '' | 'glass'; flat?: boolean; collide?: Surface }

// Start at the top of the driveway, facing the street and the kicker.
export const START = { pos: new THREE.Vector3(-8.2, 0.06, -14.2), yaw: -Math.PI / 2 };
// For tuning big air: on the park path, facing the park kicker (?start=park).
export const START_PARK = { pos: new THREE.Vector3(30, 0.74, -10.5), yaw: Math.PI / 2 };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function mesh(geo: THREE.BufferGeometry, color: number, o: Opt = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, o.kind ?? ''));
  m.castShadow = !o.flat;
  m.receiveShadow = true;
  if (o.collide) m.userData.collide = o.collide;
  return m;
}
function rb(w: number, h: number, d: number, r = 0.05): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005);
  return rr > 0.012 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
}
function box(p: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number, o: Opt = {}): THREE.Mesh {
  const m = mesh(rb(w, h, d, o.r ?? 0.05), color, o);
  m.position.set(x, y + h / 2, z);
  if (o.ry) m.rotation.y = o.ry;
  p.add(m);
  return m;
}
function slab(p: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, y: number, h: number, color: number, o: Opt = {}): THREE.Mesh {
  return box(p, x1 - x0, h, z1 - z0, color, (x0 + x1) / 2, y, (z0 + z1) / 2, o);
}
function rod(p: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, o: Opt & { seg?: number } = {}): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = mesh(new THREE.CylinderGeometry(r, r, len, o.seg ?? 8), color, o);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  p.add(m);
  return m;
}
function blob(p: THREE.Object3D, x: number, y: number, z: number, r: number, color: number, sy = 0.85, o: Opt = {}): THREE.Mesh {
  const m = mesh(new THREE.IcosahedronGeometry(r, 1), color, o);
  m.scale.set(1, sy, 1);
  m.position.set(x, y, z);
  m.rotation.y = rnd() * 3;
  p.add(m);
  return m;
}
function flatShape(p: THREE.Object3D, pts: [number, number][], y: number, h: number, color: number, collide: Surface): THREE.Mesh {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = mesh(geo, color, { flat: true, collide });
  m.position.y = y;
  p.add(m);
  return m;
}
// A wedge whose lip sits at (x, y, z); yaw is the direction a rider launches (0 = +x).
function kicker(p: THREE.Object3D, x: number, y: number, z: number, yaw: number, length: number, height: number, width: number): THREE.Mesh {
  const shape = new THREE.Shape([new THREE.Vector2(-length, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, height)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  const m = mesh(geo, C.wood, { collide: 'ramp' });
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  // a yellow edge on the lip, so the takeoff reads from far away
  const edge = mesh(new THREE.CylinderGeometry(0.05, 0.05, width, 8).rotateX(Math.PI / 2), C.lip);
  edge.position.set(-0.03, height - 0.02, 0);
  m.add(edge);
  p.add(m);
  return m;
}
// Gable roof over a w (x) by d (z) rectangle centered at (cx, cz), eaves at y0, rise h.
// axis 'z': ridge along z, gable faces the street. axis 'x': ridge along x.
function gable(p: THREE.Object3D, cx: number, cz: number, w: number, d: number, y0: number, h: number, axis: 'x' | 'z', o: { color?: number; wall?: number; trim?: boolean } = {}): void {
  const g = new THREE.Group();
  g.position.set(cx, y0, cz);
  p.add(g);
  const span = axis === 'z' ? w : d, len = axis === 'z' ? d : w;
  const half = span / 2, ov = 0.45, t = 0.22;
  const ang = Math.atan2(h, half), sl = Math.hypot(half, h);
  const along = half / 2 + (ov / 2) * Math.cos(ang);
  const yy = h / 2 - (ov / 2) * Math.sin(ang) + (t / 2) * Math.cos(ang);
  const off = along + (t / 2) * Math.sin(ang);
  for (const s of [-1, 1]) {
    const m = axis === 'z' ? mesh(rb(sl + ov, t, len + 2 * ov, 0.06), o.color ?? C.roof, { collide: 'wall' }) : mesh(rb(len + 2 * ov, t, sl + ov, 0.06), o.color ?? C.roof, { collide: 'wall' });
    if (axis === 'z') {
      m.position.set(s * off, yy, 0);
      m.rotation.z = -s * ang;
    } else {
      m.position.set(0, yy, s * off);
      m.rotation.x = s * ang;
    }
    g.add(m);
  }
  const tri = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, h)]), { depth: len, bevelEnabled: false });
  tri.translate(0, 0, -len / 2);
  const infill = mesh(tri, o.wall ?? C.siding);
  if (axis === 'x') infill.rotation.y = Math.PI / 2;
  g.add(infill);
  if (!o.trim) return;
  const zf = len / 2 + ov - 0.04;
  for (const s of [-1, 1]) {
    const fa = mesh(rb(sl + ov, 0.3, 0.14, 0.04), C.trim);
    fa.position.set(s * along, h / 2 - (ov / 2) * Math.sin(ang) - 0.06, zf);
    fa.rotation.z = -s * ang;
    g.add(fa);
  }
  const zb = len / 2 + 0.07, yt = h * 0.38, ph = h * 0.8 - yt;
  const tie = mesh(rb(span * 0.6, 0.14, 0.12, 0.03), C.trim);
  tie.position.set(0, yt, zb);
  g.add(tie);
  const post = mesh(rb(0.14, ph, 0.12, 0.03), C.trim);
  post.position.set(0, yt + ph / 2, zb);
  g.add(post);
  for (const s of [-1, 1]) rod(g, V(s * span * 0.2, yt, zb), V(0, h * 0.7, zb), 0.06, C.trim, { seg: 4 });
}
function win(p: THREE.Object3D, x: number, y: number, zFace: number, w: number, h: number): void {
  slab(p, x - w / 2 - 0.14, x + w / 2 + 0.14, zFace, zFace + 0.1, y - 0.14, h + 0.28, C.trim, { r: 0.03 });
  slab(p, x - w / 2, x + w / 2, zFace + 0.08, zFace + 0.14, y, h, C.glass, { kind: 'glass', r: 0.02 });
  slab(p, x - 0.04, x + 0.04, zFace + 0.13, zFace + 0.17, y, h, C.trim, { r: 0 });
}
function column(p: THREE.Object3D, x: number, y: number, z: number, h: number): void {
  const m = mesh(new THREE.CylinderGeometry(0.17, 0.25, h, 4), C.trim, { collide: 'wall' });
  m.rotation.y = Math.PI / 4;
  m.position.set(x, y + h / 2, z);
  p.add(m);
}
function leafy(p: THREE.Object3D, x: number, z: number, h: number, r: number, y0 = 0): void {
  rod(p, V(x, y0, z), V(x, y0 + h * 0.62, z), Math.max(0.14, r * 0.07), C.trunk, { seg: 6, collide: 'wall' });
  blob(p, x, y0 + h * 0.72, z, r, C.leafy);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + x;
    blob(p, x + Math.cos(a) * r * 0.62, y0 + h * 0.6 + (i % 2) * r * 0.35, z + Math.sin(a) * r * 0.62, r * 0.68, C.leafy);
  }
}
function aspen(p: THREE.Object3D, x: number, z: number, h: number): void {
  rod(p, V(x, 0, z), V(x, h, z), 0.1, C.aspenTrunk, { seg: 6, collide: 'wall' });
  for (let i = 0; i < 4; i++) {
    const a = i * 2.1 + z;
    blob(p, x + Math.cos(a) * 0.5, h - 0.5 - i * 0.6, z + Math.sin(a) * 0.5, 0.9 - i * 0.08, C.aspen, 1.15);
  }
}
function pine(p: THREE.Object3D, x: number, z: number, h: number): void {
  rod(p, V(x, 0, z), V(x, h * 0.3, z), 0.18, C.trunk, { seg: 6, collide: 'wall' });
  for (let i = 0; i < 3; i++) {
    const r = h * (0.3 - i * 0.07), ch = h * (0.42 - i * 0.06);
    const m = mesh(new THREE.ConeGeometry(r, ch, 9), C.pine);
    m.position.set(x, h * 0.2 + i * h * 0.24 + ch / 2, z);
    p.add(m);
  }
}
function neighbor(p: THREE.Object3D, cx: number, zFront: number, facingNorth: boolean, w: number, d: number, h: number, wall: number): void {
  const g = new THREE.Group();
  g.position.set(cx, 0, zFront);
  if (facingNorth) g.rotation.y = Math.PI;
  p.add(g);
  slab(g, -w / 2, w / 2, -d, 0, 0, h, wall, { collide: 'wall' });
  gable(g, 0, -d / 2, w, d, h, 2.4, 'x', { color: C.tile, wall });
  slab(g, -w / 2, w / 2, -0.02, 0.12, 0, 0.7, C.stone, { r: 0.02, collide: 'wall' });
  slab(g, -w / 2 + 0.8, -w / 2 + 5.6, 0.0, 0.16, 0, 2.3, 0x6b5a4f, { r: 0.03 }); // garage door: in front of the stone, never in its plane
  win(g, w / 2 - 2.2, 3.4, 0.0, 1.4, 1.3);
  win(g, w / 2 - 5.0, 3.4, 0.0, 1.4, 1.3);
  win(g, w / 2 - 2.6, 0.9, 0.0, 1.8, 1.4);
}
// A parked car is solid wherever you can see it: body, cabin, windows and wheels. (Only the body used to collide, so a bike
// that came down on the hood or roof stood inside the cabin, and one beside the car sat in its wheels.)
export function car(p: THREE.Object3D, x: number, z: number, ry: number, color: number, pickup: boolean): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  p.add(g);
  box(g, pickup ? 5.6 : 4.7, 0.8, 2.0, color, 0, 0.4, 0, { r: 0.14, collide: 'wall' });
  box(g, pickup ? 2.3 : 3.3, 0.85, 1.9, color, pickup ? 0.8 : -0.2, 1.15, 0, { r: 0.16, collide: 'wall' });
  box(g, pickup ? 2.1 : 3.1, 0.52, 1.96, 0x37414a, pickup ? 0.85 : -0.2, 1.3, 0, { r: 0.08, kind: 'glass', collide: 'wall' });
  for (const [dx, dz] of [[1.7, 0.95], [1.7, -0.95], [-1.7, 0.95], [-1.7, -0.95]]) {
    const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), C.tire, { collide: 'wall' });
    w.rotation.x = Math.PI / 2;
    w.position.set(dx, 0.42, dz);
    g.add(w);
  }
}
function pickets(p: THREE.Object3D, x0: number, x1: number, z: number, y: number): void {
  const geos: THREE.BufferGeometry[] = [];
  for (let x = x0; x <= x1; x += 0.17) {
    geos.push(new THREE.BoxGeometry(0.075, 0.9, 0.035).translate(x, y + 0.45, z));
    geos.push(new THREE.ConeGeometry(0.055, 0.12, 4).rotateY(Math.PI / 4).translate(x, y + 0.96, z));
  }
  for (const yy of [0.25, 0.72]) geos.push(new THREE.BoxGeometry(x1 - x0, 0.07, 0.05).translate((x0 + x1) / 2, y + yy, z - 0.04));
  for (let x = x0; x <= x1 + 0.01; x += 2.4) geos.push(new THREE.BoxGeometry(0.11, 1.05, 0.11).translate(x, y + 0.52, z - 0.05));
  p.add(mesh(mergeGeometries(geos.map((g) => g.toNonIndexed())), C.trim, { collide: 'wall' }));
}

function street(w: THREE.Group): void {
  const ground = mesh(new THREE.CircleGeometry(420, 48), C.lawn, { flat: true, collide: 'grass' });
  ground.rotation.x = -Math.PI / 2;
  w.add(ground);
  slab(w, -95, 95, -4.5, 4.5, 0, 0.04, C.asphalt, { flat: true, r: 0, collide: 'ground' });
  for (const z of [-4.62, 4.62]) slab(w, -95, 95, z - 0.13, z + 0.13, 0, 0.17, C.concrete, { r: 0.04, collide: 'ground' });
  slab(w, -95, 95, -6.5, -4.75, 0, 0.12, C.concrete, { flat: true, r: 0, collide: 'ground' });
  slab(w, -95, 95, 4.75, 6.5, 0, 0.12, C.concrete, { flat: true, r: 0, collide: 'ground' });
  for (let i = 0; i < 9; i++) {
    const x = -60 + i * 15 + rnd() * 6;
    slab(w, x, x + 0.08, -4.2, 4.2, 0.04, 0.005, 0x55524f, { flat: true, r: 0, ry: (rnd() - 0.5) * 0.5 });
  }
}

function house(w: THREE.Group): void {
  const h = new THREE.Group();
  w.add(h);
  const wall: Opt = { collide: 'wall' };
  slab(h, -4.8, 11.8, -29, -18, 0, 6.0, C.siding, { r: 0.08, collide: 'wall' });
  gable(h, 3.5, -23.5, 16.6, 11, 6.0, 3.0, 'x');
  slab(h, -12, -4.8, -23.5, -15.5, 0, 3.2, C.siding, wall);
  gable(h, -8.4, -19.5, 7.2, 8, 3.2, 1.9, 'x');
  slab(h, -10.95, -5.85, -15.52, -15.4, 0, 2.5, C.trim, { r: 0.03 });
  slab(h, -10.75, -6.05, -15.46, -15.32, 0, 2.3, C.garageDoor, { r: 0.03, collide: 'wall' });
  for (const x of [-11.6, -5.25]) {
    slab(h, x - 0.38, x + 0.38, -15.9, -15.3, 0, 1.1, C.stone, wall);
    slab(h, x - 0.22, x + 0.22, -15.75, -15.4, 1.1, 2.1, C.trim, { r: 0.03 });
  }
  for (const x of [-11.2, -5.7]) box(h, 0.2, 0.26, 0.26, C.black, x, 2.55, -15.3, { r: 0.05 });
  slab(h, -4.8, -0.2, -18.2, -16.0, 0, 6.0, C.siding, wall);
  gable(h, -2.5, -18.4, 4.6, 4.8, 6.0, 2.7, 'z', { trim: true });
  win(h, -2.5, 3.5, -16.0, 1.5, 1.5);
  slab(h, -4.8, -0.2, -16.0, -15.86, 0, 0.7, C.stone, { r: 0.02, collide: 'wall' });
  column(h, -0.35, 0, -15.6, 3.1);
  slab(h, -0.2, 3.4, -18.2, -15.2, 0, 5.4, C.siding, wall);
  gable(h, 1.6, -17.3, 3.6, 4.2, 5.4, 2.1, 'z', { trim: true });
  win(h, 1.6, 3.4, -15.2, 1.6, 1.4);
  slab(h, 0.1, 3.1, -15.2, -14.6, 0.55, 2.3, C.trim, { r: 0.04, collide: 'wall' });
  for (const x of [0.65, 1.6, 2.55]) slab(h, x - 0.38, x + 0.38, -14.6, -14.54, 0.8, 1.8, C.glass, { kind: 'glass', r: 0.02 });
  slab(h, -0.2, 3.4, -15.2, -15.06, 0, 0.55, C.stone, { r: 0.02, collide: 'wall' });
  slab(h, 0.0, 3.2, -15.2, -14.5, 2.85, 0.18, C.roof, { r: 0.03 });
  slab(h, 3.4, 6.6, -18.2, -17.0, 0, 6.0, C.siding, wall);
  slab(h, 4.2, 6.0, -17.08, -17.0, 0.1, 2.75, C.trim, { r: 0.02 });
  slab(h, 4.55, 5.65, -17.02, -16.9, 0.15, 2.25, C.door, { r: 0.03 });
  for (const x of [4.38, 5.82]) slab(h, x - 0.13, x + 0.13, -17.0, -16.94, 0.25, 2.1, C.glass, { kind: 'glass', r: 0.01 });
  slab(h, 4.3, 5.9, -17.0, -16.94, 2.45, 0.3, C.glass, { kind: 'glass', r: 0.01 });
  box(h, 0.34, 0.34, 0.06, 0xd9534f, 5.1, 1.5, -16.86, { r: 0.03 });
  slab(h, 3.3, 6.7, -17.1, -15.4, 3.0, 0.3, C.trim, { r: 0.03 });
  slab(h, 3.35, 6.65, -17.05, -15.45, 3.3, 0.12, C.roof, { r: 0.02 });
  for (const x of [3.65, 6.35]) {
    slab(h, x - 0.32, x + 0.32, -15.95, -15.35, 0, 0.9, C.stone, wall);
    column(h, x, 0.9, -15.65, 2.1);
  }
  win(h, 5.0, 3.75, -17.0, 1.7, 1.5);
  slab(h, 3.3, 6.7, -17.0, -14.9, 0, 0.18, C.concrete, { flat: true, r: 0.02, collide: 'ground' });
  slab(h, 6.6, 12.0, -18.2, -15.3, 0, 3.7, C.siding, wall);
  gable(h, 9.3, -17.2, 5.4, 3.8, 3.7, 2.1, 'z', { trim: true });
  slab(h, 7.6, 11.0, -15.32, -15.2, 0.7, 2.9, C.trim, { r: 0.03 });
  slab(h, 7.85, 10.75, -15.2, -15.14, 0.95, 1.25, C.glass, { kind: 'glass', r: 0.01 });
  slab(h, 7.85, 10.75, -15.2, -15.14, 2.4, 1.0, C.glass, { kind: 'glass', r: 0.01 });
  for (const x of [8.8, 9.8]) slab(h, x - 0.04, x + 0.04, -15.14, -15.1, 0.95, 2.45, C.trim, { r: 0 });
  slab(h, 6.6, 12.0, -15.3, -15.16, 0, 0.7, C.stone, { r: 0.02, collide: 'wall' });
  for (const x of [-4.8, -0.2, 3.4, 6.6, 12.0]) slab(h, x - 0.09, x + 0.09, -16.1, -15.1, 0, x > 6 ? 3.7 : x > -1 && x < 4 ? 5.4 : 6.0, C.trim, { r: 0.02 });
}

function yard(w: THREE.Group): void {
  // The driveway runs under the garage door: two faces in the same plane flicker as they fight to be drawn.
  flatShape(w, [[-11.2, -15.7], [-5.6, -15.7], [-2.4, -10.5], [-1.8, -6.5], [-14.8, -6.5], [-13.6, -10.5]], 0.0, 0.06, C.concrete, 'ground');
  kicker(w, -8.2, 0.06, -8.3, -Math.PI / 2, 1.8, 0.45, 1.4); // the driveway kicker, launching toward the street
  slab(w, -2.2, 6.7, -14.9, -13.7, 0, 0.06, C.concrete, { flat: true, r: 0, collide: 'ground' });
  slab(w, -4.6, -0.4, -15.85, -14.95, 0, 0.05, C.gravel, { flat: true, r: 0, collide: 'dirt' });
  slab(w, 6.7, 12.4, -15.15, -13.9, 0, 0.05, C.gravel, { flat: true, r: 0, collide: 'dirt' });
  slab(w, -12.4, -11.3, -15.3, -13.0, 0, 0.05, C.gravel, { flat: true, r: 0, collide: 'dirt' });
  for (let i = 0; i <= 8; i++) {
    const x = 6.9 + i * (5.8 / 8), z = -13.75 + 0.8 * Math.sin((Math.PI * i) / 8);
    const zn = -13.75 + 0.8 * Math.sin((Math.PI * (i + 1)) / 8);
    box(w, 0.8, 0.55, 0.38, C.stone, x, 0, z, { r: 0.06, ry: -Math.atan2(zn - z, 5.8 / 8), collide: 'wall' });
  }
  for (const [x, z, r] of [[-1.1, -14.2, 0.6], [1.0, -12.3, 1.05], [3.0, -13.3, 0.5], [7.5, -14.4, 0.55], [9.1, -14.6, 0.6], [11.2, -14.4, 0.55], [13.2, -12.4, 0.95], [-13.5, -15.0, 0.5], [-3.9, -13.0, 0.45]]) blob(w, x, r * 0.62, z, r, C.shrub, 0.8, { collide: 'wall' });
  for (const x of [3.0, 5.6, 8.2, 10.8, 13.4]) slab(w, x - 0.08, x + 0.08, -10.78, -10.62, 0, 1.15, C.rail, { r: 0.02, collide: 'wall' });
  for (let i = 0; i < 4; i++) for (const y of [0.45, 0.92]) slab(w, 3.0 + i * 2.6, 5.6 + i * 2.6, -10.75, -10.65, y, 0.1, C.rail, { r: 0.02, collide: 'wall' });
  for (const [x, z, color] of [[-4.25, -14.95, C.bin], [-3.45, -14.85, C.binBlue]]) {
    box(w, 0.62, 1.0, 0.72, color, x, 0, z, { r: 0.06, collide: 'wall' });
    box(w, 0.7, 0.08, 0.8, color, x, 1.0, z + 0.02, { r: 0.03 });
  }
  box(w, 0.7, 0.36, 0.7, 0x9ea3a6, -12.0, 0, -14.85, { r: 0.12, collide: 'wall' });
  aspen(w, -14.6, -13.2, 7.5);
  aspen(w, -15.6, -17.5, 8.5);
  aspen(w, -13.4, -21.0, 7.0);
  aspen(w, -1.6, -10.4, 6.0);
  pine(w, 14.0, -19.5, 9);
  pine(w, 15.5, -25, 11);
  pine(w, 11.5, -31, 10);
  leafy(w, -3, -34, 11, 3.2);
  leafy(w, 7, -35, 12, 3.4);
}

function neighborhood(w: THREE.Group): void {
  neighbor(w, -25, -16, false, 12, 11, 5.8, C.cream);
  neighbor(w, -40, -15, false, 12, 11, 5.6, C.stucco);
  neighbor(w, 78, -16, false, 12, 11, 5.8, C.stucco);
  neighbor(w, -22, 15, true, 12, 11, 5.8, C.stucco);
  neighbor(w, -4, 16, true, 13, 11, 6.0, C.cream);
  neighbor(w, 14, 15, true, 12, 11, 5.6, C.stucco);
  neighbor(w, 32, 16, true, 12, 11, 5.8, C.cream);
  for (const x of [-44, -30, -16, 46, 60]) leafy(w, x, 8.6, 9 + rnd() * 3, 2.6 + rnd() * 0.8);
  for (const x of [-20, -33]) leafy(w, x, -9.5, 9 + rnd() * 2, 2.6);
  car(w, 21, -3.45, 0, C.truck, true);
  car(w, -3.5, 11.5, Math.PI / 2, C.suv, false);
}

// Indian Peaks Trail West Park: steps up from the street, a long clear run to the kicker and its landing,
// the playground off to the east and the picnic table to the west, so the riding lines stay open.
function park(w: THREE.Group): void {
  const p = new THREE.Group();
  w.add(p);
  const PY = 0.7, X0 = 15, X1 = 66;
  slab(p, X0, X1, -70, -8.4, 0, PY, C.lawn, { flat: true, r: 0, collide: 'grass' });
  slab(p, X0, 28.6, -8.4, -6.6, 0, 0.35, C.mulch, { flat: true, r: 0, collide: 'dirt' });
  slab(p, 31.4, X1, -8.4, -6.6, 0, 0.35, C.mulch, { flat: true, r: 0, collide: 'dirt' });
  for (let i = 0; i < 4; i++) slab(p, 28.6, 31.4, -8.4, -6.6 - 0.45 * i, 0, 0.12 + ((i + 1) * (PY - 0.12)) / 4, C.concrete, { r: 0.02, collide: 'ground' });
  for (const x of [28.45, 31.55]) {
    rod(p, V(x, 1.2, -6.7), V(x, PY + 0.95, -8.4), 0.03, C.black, { collide: 'rail' });
    rod(p, V(x, PY + 0.95, -8.4), V(x, PY + 0.95, -9.2), 0.03, C.black, { collide: 'rail' });
    for (const [z, y0, y1] of [[-6.7, 0.35, 1.2], [-7.55, 0.35, 1.43], [-8.4, PY, PY + 0.95]]) rod(p, V(x, y0, z), V(x, y1, z), 0.03, C.black, { collide: 'rail' });
  }
  pickets(p, X0 + 0.2, 28.3, -8.45, PY);
  pickets(p, 31.7, X1 - 0.2, -8.45, PY);
  slab(p, 28.6, 31.4, -14, -8.4, PY, 0.04, C.concrete, { flat: true, r: 0, collide: 'ground' });
  slab(p, 31.4, 42.5, -14, -12.6, PY, 0.04, C.concrete, { flat: true, r: 0, collide: 'ground' });
  slab(p, 21, 28.6, -14, -12.6, PY, 0.04, C.concrete, { flat: true, r: 0, collide: 'ground' });
  kicker(p, 30, PY, -22, Math.PI / 2, 3.0, 1.2, 2.0); // the park kicker: 8 m of run-up, open lawn to land on

  // playground, east of the kicker line
  slab(p, 42.5, 57, -27, -12, PY, 0.05, C.mulch, { flat: true, r: 0, collide: 'dirt' });
  const T = { x: 47, z: -19.5 };
  const deckY = PY + 1.45;
  for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) rod(p, V(T.x + dx, PY, T.z + dz), V(T.x + dx, deckY + 1.9, T.z + dz), 0.085, C.playGreen, { collide: 'wall' });
  slab(p, T.x - 1.2, T.x + 1.2, T.z - 1.2, T.z + 1.2, deckY - 0.12, 0.12, C.playGreen, { r: 0.03, collide: 'ground' });
  slab(p, T.x - 1.15, T.x + 1.15, T.z - 1.18, T.z - 1.08, deckY, 0.9, C.playGreen, { r: 0.02, collide: 'wall' });
  slab(p, T.x - 1.15, T.x + 0.2, T.z + 1.08, T.z + 1.18, deckY, 0.9, C.playGreen, { r: 0.02, collide: 'wall' });
  for (const dx of [-0.55, 0.55]) {
    const lantern = mesh(new THREE.CylinderGeometry(0.42, 0.62, 0.75, 6), C.playGreen);
    lantern.position.set(T.x + dx, deckY + 2.25, T.z);
    p.add(lantern);
    const cap = mesh(new THREE.ConeGeometry(0.46, 0.36, 6), C.playGreen);
    cap.position.set(T.x + dx, deckY + 2.8, T.z);
    p.add(cap);
  }
  // the slide ends low enough to ride up it
  const s0 = V(T.x + 1.2, deckY + 0.05, T.z), s1 = V(T.x + 5.2, PY + 0.3, T.z);
  const dir = s1.clone().sub(s0);
  const slide = new THREE.Group();
  slide.position.copy(s0).add(s1).multiplyScalar(0.5);
  slide.rotation.z = Math.atan2(dir.y, dir.x);
  p.add(slide);
  slide.add(mesh(rb(dir.length(), 0.08, 1.3, 0.03), C.slide, { collide: 'ramp' }));
  for (const s of [-1, 1]) {
    const railM = mesh(rb(dir.length(), 0.26, 0.1, 0.04), C.slide);
    railM.position.set(0, 0.14, s * 0.65);
    slide.add(railM);
  }
  slab(p, s1.x - 0.05, s1.x + 0.9, T.z - 0.65, T.z + 0.65, PY + 0.24, 0.08, C.slide, { r: 0.03, collide: 'ramp' });
  const n0 = V(T.x - 1.2, deckY, T.z), n1 = V(T.x - 3.7, PY, T.z);
  for (const dz of [-0.6, 0.6]) rod(p, V(n0.x, n0.y, T.z + dz), V(n1.x, n1.y, T.z + dz), 0.06, C.playGreen, { collide: 'wall' });
  for (let i = 1; i < 6; i++) {
    const q = n0.clone().lerp(n1, i / 6);
    rod(p, V(q.x, q.y, T.z - 0.6), V(q.x, q.y, T.z + 0.6), 0.035, C.playGreen);
  }
  slab(p, 57.5, 64.5, -23, -16, PY, 0.05, C.mulch, { flat: true, r: 0, collide: 'dirt' });
  const SW = { x0: 58.7, x1: 63.3, z: -19.5, top: PY + 2.6 };
  rod(p, V(SW.x0, SW.top, SW.z), V(SW.x1, SW.top, SW.z), 0.08, C.playGreen);
  for (const x of [SW.x0, SW.x1]) for (const dz of [-0.9, 0.9]) rod(p, V(x, SW.top, SW.z), V(x, PY, SW.z + dz), 0.075, C.playGreen, { collide: 'wall' });
  for (const x of [60, 62]) {
    for (const dx of [-0.25, 0.25]) rod(p, V(x + dx, SW.top, SW.z), V(x + dx, PY + 0.62, SW.z), 0.015, C.black, { seg: 4 });
    slab(p, x - 0.3, x + 0.3, SW.z - 0.12, SW.z + 0.12, PY + 0.55, 0.07, C.black, { r: 0.02, collide: 'wall' });
  }
  bench(p, 39.5, -16.6, PY);

  // picnic table, west of the kicker line, and the bin by the path
  picnicTable(p, 18.6, -16, PY);
  slab(p, 21.6, 22.4, -12.3, -11.7, PY, 0.95, 0x3d3a36, { r: 0.05, collide: 'wall' });
  rod(p, V(26.6, PY, -9.5), V(26.6, PY + 1.3, -9.5), 0.05, C.playGreen, { collide: 'wall' });
  slab(p, 26.0, 27.2, -9.56, -9.44, PY + 1.0, 0.5, 0x6b5443, { r: 0.03 });

  for (const [x, z, r] of [[38, -9.7, 0.8], [39.8, -9.5, 0.6], [41.4, -9.9, 0.9], [43.3, -9.6, 0.7], [45.1, -10.0, 0.85], [46.9, -9.6, 0.65], [48.6, -9.9, 0.8], [50.3, -9.5, 0.6]]) {
    const m = mesh(new THREE.DodecahedronGeometry(r, 0), C.boulder, { collide: 'wall' });
    m.scale.set(1.3, 0.72, 1.0);
    m.rotation.set(x, z, 0.3 * x);
    m.position.set(x, PY + r * 0.45, z);
    p.add(m);
  }
  // trees round the edges, none near the kicker run-up or its landing
  for (const [x, z, h, r] of [[18, -28, 12, 3.2], [20, -42, 12, 3.2], [17, -56, 13, 3.4], [27, -63, 12, 3.2], [40, -59, 13, 3.4], [52, -65, 12, 3.2], [62, -50, 11, 3.0], [47, -40, 13, 3.4], [58, -34, 11, 3.0], [62, -29, 10, 2.8], [16.6, -10.4, 8, 2.2]]) leafy(p, x, z, h, r, PY);
}

// A wooden picnic table: top, two benches and splayed legs, centered at (x, z), long side along x.
function picnicTable(p: THREE.Object3D, x: number, z: number, y: number): void {
  const wood = 0x8a6446, len = 2.0;
  slab(p, x - len / 2, x + len / 2, z - 0.4, z + 0.4, y + 0.72, 0.07, wood, { r: 0.02, collide: 'wall' });
  for (const s of [-1, 1]) slab(p, x - len / 2, x + len / 2, z + s * 0.85 - 0.16, z + s * 0.85 + 0.16, y + 0.42, 0.06, wood, { r: 0.02, collide: 'wall' });
  for (const lx of [x - len / 2 + 0.25, x + len / 2 - 0.25]) {
    for (const s of [-1, 1]) rod(p, V(lx, y + 0.72, z + s * 0.3), V(lx, y, z + s * 1.0), 0.04, wood, { collide: 'wall' });
    slab(p, lx - 0.04, lx + 0.04, z - 1.05, z + 1.05, y + 0.36, 0.06, wood, { r: 0.01 });
  }
}

// A park bench facing north, with legs and a back.
function bench(p: THREE.Object3D, x: number, z: number, y: number): void {
  const metal = 0x3d3a36;
  slab(p, x - 1, x + 1, z - 0.2, z + 0.2, y + 0.42, 0.06, metal, { r: 0.02, collide: 'wall' });
  slab(p, x - 1, x + 1, z + 0.18, z + 0.24, y + 0.55, 0.4, metal, { r: 0.02 });
  for (const lx of [x - 0.85, x + 0.85]) for (const dz of [-0.15, 0.18]) rod(p, V(lx, y, z + dz), V(lx, y + 0.45, z + dz), 0.03, metal, { collide: 'wall' });
}

function frontRange(w: THREE.Group): void {
  for (let i = 0; i < 22; i++) {
    const phi = -0.95 + i * 0.075 + (rnd() - 0.5) * 0.04;
    const R = 340 + rnd() * 60, h = 26 + rnd() * 26, r = 40 + rnd() * 30;
    const x = -R * Math.cos(phi), z = R * Math.sin(phi);
    const m = mesh(new THREE.ConeGeometry(r, h, 5 + Math.floor(rnd() * 3)), C.mountain, { flat: true });
    m.position.set(x, h / 2 - 2, z);
    m.rotation.y = rnd() * 3;
    w.add(m);
    const cap = mesh(new THREE.ConeGeometry(r * 0.28, h * 0.28, 5), C.snow, { flat: true });
    cap.position.set(x, h - 2 - h * 0.14 + 0.5, z);
    cap.rotation.y = m.rotation.y;
    w.add(cap);
  }
  flatirons(w);
}

// The Flatirons: tilted slabs of red rock leaning on a forested hill, off to the southwest. Faceted
// (unindexed, flat normals) so they read as rock, with a band of pines along their feet.
function flatirons(w: THREE.Group): void {
  const R = 235, center = 0.43; // distance and bearing from home, radians south of west
  // the forested hill sits behind the slabs; they lean back into it with their faces in the open
  const hillAt = new THREE.Group();
  hillAt.position.set(-(R + 62) * Math.cos(center), -4, (R + 62) * Math.sin(center));
  hillAt.lookAt(0, -4, 0);
  w.add(hillAt);
  const hill = mesh(new THREE.IcosahedronGeometry(1, 2), C.foothill, { flat: true });
  hill.scale.set(120, 36, 48);
  hillAt.add(hill);
  // each slab: a rough five-sided pyramid squashed flat, so its face breaks into facets along a ridge;
  // spaced apart and staggered in depth, like the real ones
  const slabs: [number, number, number, number, number][] = [
    [-0.13, 8, 34, 38, 0.85], [-0.06, -4, 58, 60, 0.7], [0.02, 3, 48, 52, 0.78], [0.09, -6, 38, 42, 0.72], [0.145, 10, 22, 26, 0.9],
  ];
  for (const [dPhi, dR, h, wd, lean] of slabs) {
    const phi = center + dPhi, r = R + dR;
    const geo = new THREE.ConeGeometry(1, 1, 5, 3).toNonIndexed();
    const pos = geo.getAttribute('position');
    const jitter = new Map<string, [number, number]>(); // the same corner moves the same way in every face
    for (let i = 0; i < pos.count; i++) {
      const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => Math.round(v * 1000)).join(); // -0 and 0 match
      if (!jitter.has(key)) jitter.set(key, pos.getY(i) > 0.49 ? [0, 0] : [(rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.12]);
      const [jx, jy] = jitter.get(key)!;
      pos.setXYZ(i, pos.getX(i) + jx, pos.getY(i) + jy, pos.getZ(i));
    }
    geo.scale(wd / 2, h, 7).translate(0, h / 2, 0);
    geo.computeVertexNormals();
    const g = new THREE.Group();
    g.position.set(-r * Math.cos(phi), -3, r * Math.sin(phi));
    g.lookAt(0, -3, 0);
    w.add(g);
    const m = mesh(geo, C.flatiron, { flat: true });
    m.rotation.x = -lean; // lean back against the hill
    g.add(m);
  }
  const pines: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) {
    const phi = center - 0.14 + rnd() * 0.32, r = R - 6 + rnd() * 22, h = 7 + rnd() * 6;
    pines.push(new THREE.ConeGeometry(h * 0.32, h, 6).toNonIndexed().translate(-r * Math.cos(phi), h / 2 - 2, r * Math.sin(phi)));
  }
  w.add(mesh(mergeGeometries(pines), C.pine, { flat: true }));
}

export function buildWorld(): THREE.Group {
  const w = new THREE.Group();
  street(w);
  house(w);
  yard(w);
  neighborhood(w);
  park(w);
  frontRange(w);
  return w;
}

// After colliders are built: merge everything that shares a material into one mesh, so the iPad draws ~40 batches.
export function mergeStatic(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const m of meshes) {
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    const material = m.material as THREE.Material;
    // keep vertex colours where the material paints with them (the hill's land), so its patches survive the merge
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && !(name === 'color' && material.vertexColors)) g.deleteAttribute(name);
    const entry = groups.get(material) ?? { geos: [], cast: false };
    entry.geos.push(g);
    entry.cast ||= m.castShadow;
    groups.set(material, entry);
    m.removeFromParent();
  }
  root.clear();
  for (const [material, { geos, cast }] of groups) {
    const merged = new THREE.Mesh(mergeGeometries(geos), material);
    merged.castShadow = cast;
    merged.receiveShadow = true;
    root.add(merged);
  }
}
