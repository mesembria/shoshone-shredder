// The trail tool: a path on the ground (straights and arcs) plus a height profile along it. A trail is how the
// first area gets curves; everything else (ribbons, zones, gates) is measured along the path.
import * as THREE from 'three';
import { heightAt, mesh, rock, type Profile, type Area, type Gate, type Line, type Climb } from '../lab/course';
import { C } from '../look/palette';
import { mat } from '../look/toyLook';

const SAMPLE = 0.1; // the path is a polyline with a point every 0.1 m
const BLOCK = 32;   // segments per bounding box in the nearest-point search

// A path on the ground. yaw is the bike's: 0 is +x, forward is (cos yaw, -sin yaw) in (x, z). Left turns are positive.
// u is the distance along the path; off is the sideways distance from it, positive to the rider's right.
export class TrailPath {
  private xs: number[]; private zs: number[]; private yaws: number[]; private us: number[];
  // the pieces it was built from, in order: a straight has no radius
  readonly pieces: { len: number; radius?: number; turnDeg?: number }[] = [];
  constructor(x: number, z: number, yaw: number) {
    this.xs = [x]; this.zs = [z]; this.yaws = [yaw]; this.us = [0];
  }
  private boxes: number[] = []; // x0, x1, z0, z1 of each run of BLOCK segments, built on first use
  private hit = { u: 0, off: 0, dist: Infinity }; private hitX = 0; private hitZ = 0; private hitValid = false;
  private push(x: number, z: number, yaw: number, du: number): void {
    this.boxes = []; this.hitValid = false;
    this.xs.push(x); this.zs.push(z); this.yaws.push(yaw); this.us.push(this.length + du);
  }
  private get last() {
    const i = this.xs.length - 1;
    return { x: this.xs[i], z: this.zs[i], yaw: this.yaws[i] };
  }
  straight(len: number): this {
    const n = Math.max(1, Math.ceil(len / SAMPLE)), d = len / n;
    this.pieces.push({ len });
    for (let i = 0; i < n; i++) {
      const { x, z, yaw } = this.last;
      this.push(x + d * Math.cos(yaw), z - d * Math.sin(yaw), yaw, d);
    }
    return this;
  }
  // turn through turnDeg (left is positive) on a circle of the given radius
  arc(radius: number, turnDeg: number): this {
    const turn = (turnDeg * Math.PI) / 180, s = Math.sign(turn), len = radius * Math.abs(turn);
    const n = Math.max(1, Math.ceil(len / SAMPLE)), d = len / n;
    this.pieces.push({ len, radius, turnDeg });
    // the circle's centre is one radius to the side we turn toward; the left of (cos, -sin) is (-sin, -cos)
    const { x, z, yaw } = this.last;
    const cx = x - s * radius * Math.sin(yaw), cz = z - s * radius * Math.cos(yaw);
    for (let i = 1; i <= n; i++) {
      const a = yaw + (turn * i) / n;
      this.push(cx + s * radius * Math.sin(a), cz + s * radius * Math.cos(a), a, d);
    }
    return this;
  }
  get length(): number { return this.us[this.us.length - 1]; }
  // the heading at u, without a new object (for per-step checks)
  yawAt(u: number): number {
    const us = this.us, c = Math.max(0, Math.min(this.length, u));
    let lo = 0, hi = us.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (us[mid] <= c) lo = mid; else hi = mid;
    }
    const span = us[hi] - us[lo], t = span > 0 ? (c - us[lo]) / span : 0;
    return this.yaws[lo] + (this.yaws[hi] - this.yaws[lo]) * t;
  }
  at(u: number): { x: number; z: number; yaw: number } {
    const us = this.us, c = Math.max(0, Math.min(this.length, u));
    let lo = 0, hi = us.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (us[mid] <= c) lo = mid; else hi = mid;
    }
    const span = us[hi] - us[lo], t = span > 0 ? (c - us[lo]) / span : 0, l = (a: number[]) => a[lo] + (a[hi] - a[lo]) * t;
    return { x: l(this.xs), z: l(this.zs), yaw: l(this.yaws) };
  }
  // The closest point on the path to (x, z), with how far along it is and how far to the right. Every zone test on a
  // trail asks this of the same point in a step, so the answer is kept for the last point asked (and dropped when the
  // path grows). Runs of BLOCK segments carry a bounding box: a run whose box is already farther than the best so far
  // cannot hold a strictly closer segment, so it is skipped. The segment maths is the plain scan's, in the same order,
  // so the answer is the same bit for bit.
  nearest(x: number, z: number): { u: number; off: number; dist: number } {
    const r = this.probe(x, z);
    return { u: r.u, off: r.off, dist: r.dist };
  }
  // the same answer without a new object: the result is shared and only good until the next call
  probe(x: number, z: number): { u: number; off: number; dist: number } {
    const r = this.hit;
    if (this.hitValid && this.hitX === x && this.hitZ === z) return r;
    const { xs, zs, us } = this, n = xs.length - 1;
    if (this.boxes.length === 0 && n > 0) this.buildBoxes();
    const boxes = this.boxes;
    let bu = 0, boff = 0, bd = Infinity;
    for (let b = 0; b < boxes.length; b += 4) {
      if (bd < Infinity) {
        const ex = Math.max(boxes[b] - x, 0, x - boxes[b + 1]), ez = Math.max(boxes[b + 2] - z, 0, z - boxes[b + 3]);
        if (ex * ex + ez * ez > bd * bd * (1 + 1e-9) + 1e-12) continue; // nothing in it can beat the best so far
      }
      const i0 = (b >> 2) * BLOCK, i1 = Math.min(n, i0 + BLOCK);
      for (let i = i0; i < i1; i++) {
        const dx = xs[i + 1] - xs[i], dz = zs[i + 1] - zs[i], len2 = dx * dx + dz * dz;
        const px = x - xs[i], pz = z - zs[i];
        const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / len2)) : 0;
        const dist = Math.hypot(px - t * dx, pz - t * dz);
        if (dist >= bd) continue;
        const len = Math.sqrt(len2);
        // the right of heading (fx, fz) is (-fz, fx)
        bu = us[i] + t * (us[i + 1] - us[i]); boff = len > 0 ? (px * -dz + pz * dx) / len : 0; bd = dist;
      }
    }
    r.u = bu; r.off = boff; r.dist = bd;
    this.hitX = x; this.hitZ = z; this.hitValid = true;
    return r;
  }
  private buildBoxes(): void {
    const { xs, zs } = this, n = xs.length - 1, out: number[] = [];
    for (let i0 = 0; i0 < n; i0 += BLOCK) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = i0; i <= Math.min(n, i0 + BLOCK); i++) {
        x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); z0 = Math.min(z0, zs[i]); z1 = Math.max(z1, zs[i]);
      }
      out.push(x0, x1, z0, z1);
    }
    this.boxes = out;
  }
}

export interface Trail { id: string; path: TrailPath; profile: Profile; width: number; y0: number }

export const trailY = (t: Trail, u: number): number => t.y0 + heightAt(t.profile, u);

// the point u along the trail, off to the right and lift above the surface
export function trailPoint(t: Trail, u: number, off = 0, lift = 0): THREE.Vector3 {
  const p = t.path.at(u);
  return new THREE.Vector3(p.x + off * Math.sin(p.yaw), trailY(t, u) + lift, p.z + off * Math.cos(p.yaw));
}

// The riding surface swept along the path, with skirts down both sides so the edges don't float. Rows sit at every
// profile point and where the path's pieces meet, and every `step` meters round a bend (a straight needs none in
// between: like the old park's extruded trails, its triangles then run whole from one profile point to the next).
// A vertical step in the profile gets two rows at the same u, so the ledge face stays vertical.
export function trailRibbon(t: Trail, opts: { u0?: number; u1?: number; skirt?: number; step?: number } = {}): THREE.BufferGeometry {
  const u0 = opts.u0 ?? 0, u1 = opts.u1 ?? t.path.length, skirt = opts.skirt ?? 0.4, step = opts.step ?? 0.25;
  const us = [u0, u1];
  let end = 0;
  for (const piece of t.path.pieces) {
    const start = end;
    end += piece.len;
    if (end > u0 && end < u1) us.push(end);
    if (piece.radius !== undefined) for (let u = Math.max(u0, start) + step; u < Math.min(u1, end); u += step) us.push(u);
  }
  for (const [u] of t.profile.pts) if (u > u0 && u < u1) us.push(u);
  us.sort((a, b) => a - b);
  const rows: { u: number; h: number }[] = [];
  for (const u of us) {
    if (rows.length && u - rows[rows.length - 1].u < 1e-6) continue;
    const same = t.profile.pts.filter(([pu]) => Math.abs(pu - u) < 1e-6);
    if (same.length > 1) rows.push({ u, h: same[0][1] });
    rows.push({ u, h: heightAt(t.profile, u) });
  }
  const pos: number[] = [];
  const tri = (...v: THREE.Vector3[]) => v.forEach((p) => pos.push(p.x, p.y, p.z));
  const edge = (r: { u: number; h: number }, off: number, drop = 0) => {
    const p = trailPoint(t, r.u, off);
    return p.setY(t.y0 + r.h - drop);
  };
  const half = t.width / 2;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    const l0 = edge(a, -half), r0 = edge(a, half), l1 = edge(b, -half), r1 = edge(b, half);
    tri(l0, r0, l1, r0, r1, l1);
    if (skirt <= 0) continue;
    const ld0 = edge(a, -half, skirt), ld1 = edge(b, -half, skirt), rd0 = edge(a, half, skirt), rd1 = edge(b, half, skirt);
    tri(l0, l1, ld0, l1, ld1, ld0); // left side faces left
    tri(r0, rd0, r1, r1, rd0, rd1); // right side faces right
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Tall grass beside a trail: a strip from its edge out `width` metres on one side (side +1 is the rider's right), from u0
// to u1, for a mesh tagged 'tallgrass'. The width can change along the trail (a function of u), where the strip has to
// stop short of something. It lies a hair under the ribbon's edge; given the land's height it drapes just above the
// ground instead (a few millimetres), never higher than the riding surface where it meets the ribbon's edge (out past
// it, where the land rises above the trail, it rises with the land).
export function edgeBand(t: Trail, side: -1 | 1, u0: number, u1: number, width: number | ((u: number) => number) = 1.6, ground?: (x: number, z: number) => number): THREE.BufferGeometry {
  const wide = typeof width === 'number' ? () => width : width;
  const rows = Math.max(1, Math.ceil((u1 - u0) / 0.5)), cols = 4, half = t.width / 2;
  const grid: THREE.Vector3[][] = [];
  for (let i = 0; i <= rows; i++) {
    const u = u0 + ((u1 - u0) * i) / rows, top = trailY(t, u) - 0.01, w = wide(u), row: THREE.Vector3[] = [];
    for (let j = 0; j <= cols; j++) {
      const p = trailPoint(t, u, side * (half + (w * j) / cols));
      row.push(p.setY(!ground ? top - 0.002 : j === 0 ? Math.min(top, ground(p.x, p.z) + 0.006) : ground(p.x, p.z) + 0.006));
    }
    grid.push(row);
  }
  // The strip's triangles are flat and the land's aren't: where the land bends between the strip's corners (a crease
  // where the bench meets the hillside) it could come up through. So look closely inside each triangle and lift its
  // corners wherever the land is within a few millimetres; it only ever lifts, so one pass holds.
  if (ground) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j], d = grid[i + 1][j + 1];
    for (const [p, q, r] of [[a, b, c], [b, d, c]]) {
      let lift = 0;
      for (let m = 0; m <= 4; m++) for (let n = 0; n <= 4 - m; n++) {
        const wq = m / 4, wr = n / 4, wp = 1 - wq - wr;
        const x = p.x * wp + q.x * wq + r.x * wr, z = p.z * wp + q.z * wq + r.z * wr, y = p.y * wp + q.y * wq + r.y * wr;
        lift = Math.max(lift, ground(x, z) + 0.004 - y);
      }
      if (lift > 0) for (const v of [p, q, r]) v.y += lift;
    }
  }
  if (ground) for (let i = 0; i <= rows; i++) grid[i][0].y = Math.min(grid[i][0].y, trailY(t, u0 + ((u1 - u0) * i) / rows) - 0.01);
  const pos: number[] = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    // every triangle faces up, whichever side of the trail it is on
    const up = e1.subVectors(b, a).cross(e2.subVectors(c, a)).y >= 0;
    for (const p of up ? [a, b, c] : [a, c, b]) pos.push(p.x, p.y, p.z);
  };
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j], d = grid[i + 1][j + 1];
    tri(a, b, c);
    tri(b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.userData.collide = 'tallgrass';
  return geo;
}

// A stretch of a trail: from u0 to u1 along it, and between two sideways offsets (the whole width by default). up: which
// way along the trail it counts (1: toward higher u, -1: toward lower u); without it, both ways.
export interface TrailZone { trail: Trail; u0: number; u1: number; off0?: number; off1?: number; up?: 1 | -1 }
export type Zone = Area | TrailZone;

export function inZone(z: Zone, x: number, zz: number): boolean {
  if (!('trail' in z)) return x >= z.x0 && x <= z.x1 && zz >= z.z0 && zz <= z.z1;
  const { u, off } = z.trail.path.probe(x, zz), half = z.trail.width / 2;
  return u >= z.u0 && u <= z.u1 && off >= (z.off0 ?? -half) && off <= (z.off1 ?? half);
}

// In the zone, riding the way it counts (yaw: the bike's heading). A climb is only a climb ridden up, so one trail can
// be ridden both ways: legs-limited going up, pedaling and gravity coming down.
export function inZoneHeading(z: Zone, x: number, zz: number, yaw: number): boolean {
  if (!inZone(z, x, zz)) return false;
  if (!('trail' in z) || !z.up) return true;
  const along = z.trail.path.at(z.trail.path.probe(x, zz).u).yaw;
  return Math.cos(yaw - along) * z.up > 0;
}

// A line across the trail at u, as a Gate: `a` on the rider's right, `b` on the left, so crossing it riding along
// the trail counts as forward (the other way round when `reverse`).
export function gateAcross(t: Trail, u: number, half: number, reverse = false): Gate {
  const right = trailPoint(t, u, half), left = trailPoint(t, u, -half);
  const r = new THREE.Vector2(right.x, right.z), l = new THREE.Vector2(left.x, left.z);
  return reverse ? { a: l, b: r } : { a: r, b: l };
}

// A ledge (or log) you hop: pos is the middle of its top edge, yaw the way you ride up and over it, half how far its
// edge reaches to each side.
export interface Ledge { pos: THREE.Vector3; yaw: number; half: number; log?: boolean }

// A line across the ledge's edge, a little wider than the ledge so a clip of the corner still counts. `a` is on the
// rider's right, `b` on the left, so riding up and over it crosses forward.
export function ledgeGate(l: Ledge): Gate {
  const fx = Math.cos(l.yaw), fz = -Math.sin(l.yaw), w = l.half + 0.1;
  // the right of heading (fx, fz) is (-fz, fx)
  return {
    a: new THREE.Vector2(l.pos.x - fz * w, l.pos.z + fx * w),
    b: new THREE.Vector2(l.pos.x + fz * w, l.pos.z - fx * w),
  };
}

// How many metres ahead the ledge is along its own riding direction, or Infinity when you're not lined up for it: facing
// away, already past it, or off to the side.
export function ledgeAhead(l: Ledge, x: number, z: number, yaw: number): number {
  if (Math.cos(yaw - l.yaw) <= 0.5) return Infinity;
  const fx = Math.cos(l.yaw), fz = -Math.sin(l.yaw), dx = l.pos.x - x, dz = l.pos.z - z;
  const ahead = dx * fx + dz * fz, side = dx * -fz + dz * fx;
  return ahead > 0 && Math.abs(side) < l.half + 0.3 ? ahead : Infinity;
}

// A trail's features in trail coordinates (u along, off to the rider's right), for placeFeatures to build. ledges are
// the edges to hop (a profile step, a slab's near edge, a log); slabs and logs are the solid things themselves.
export interface TrailFeatures {
  ledges: { trail: Trail; u: number; off?: number; half: number; log?: boolean }[];
  rocks: { trail: Trail; u: number; off: number; r: number }[];
  gravel: { trail: Trail; u0: number; u1: number; off0: number; off1: number }[];
  // reverse: the jump faces back down the trail (a step-down for riders coming down a trail built to be ridden up)
  jumps: { trail: Trail; lipU: number; lipH: number; knuckle: number; landLen: number; drop: number; reverse?: boolean }[];
  slabs: { trail: Trail; u: number; off: number; len: number; wid: number }[];
  logs: { trail: Trail; u: number; r: number }[];
}

// The stretches of a trail with something on it you could ride round: rocks on the riding line, ledges and logs, slabs,
// gravel; each reaching `lead` metres before and after it (riders come both ways on some trails), joined where close
export function obstacleSpans(f: TrailFeatures, t: Trail, lead = 0): [number, number][] {
  const raw: [number, number][] = [];
  for (const r of f.rocks) if (r.trail.id === t.id && Math.abs(r.off) < t.width / 2) raw.push([r.u - r.r, r.u + r.r]);
  for (const l of f.ledges) if (l.trail.id === t.id) raw.push([l.u - 0.3, l.u + 0.3]);
  for (const g of f.gravel) if (g.trail.id === t.id) raw.push([g.u0, g.u1]);
  for (const s of f.slabs) if (s.trail.id === t.id) raw.push([s.u - s.len / 2, s.u + s.len / 2]);
  for (const g of f.logs) if (g.trail.id === t.id) raw.push([g.u - 0.3, g.u + 0.3]);
  raw.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of raw) {
    const last = out[out.length - 1];
    if (last && a - lead <= last[1] + lead) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => [Math.max(0, a - lead), Math.min(t.path.length, b + lead)]);
}

// A yellow bar across the trail just before u, `y` high, so an edge reads from far away (like the old lipBar)
export function barAcross(w: THREE.Object3D, t: Trail, u: number, y: number, half: number, off = 0): void {
  const p = trailPoint(t, u - 0.04, off), m = mesh(new THREE.CylinderGeometry(0.06, 0.06, half * 2, 8).rotateX(Math.PI / 2), C.lip);
  m.position.set(p.x, y - 0.03, p.z);
  m.rotation.y = t.path.at(u).yaw;
  w.add(m);
}

// A rock's shape seed from where it sits on its trail (the trail, how far along, how far off), not where that is in
// the world: lay the trail somewhere else and its rocks come out the same shapes, so it rides the same.
export function trailSeed(t: Trail, u: number, off: number): number {
  let id = 0;
  for (const ch of t.id) id = (id * 31 + ch.charCodeAt(0)) % 9973;
  const k = Math.sin(u * 12.9898 + off * 78.233 + id * 0.731) * 43758.5453;
  return k - Math.floor(k);
}

// a cheap steady scatter for the gravel's pebbles (no Math.random, so every build looks the same)
const pebbleRnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Turn trail-coordinate features into the world: rocks, slabs and logs as solid meshes, ledge edges as Ledges with a
// lip bar, jumps as Lines with a lip bar, and gravel as loose zones with pebbles strewn on it. Solid things keep the
// old course's heights against the riding surface (the old dirt sat 2 cm up, so rocks and slabs were set from 2 cm
// under it).
export function placeFeatures(w: THREE.Group, f: TrailFeatures, lines: Line[], climb: Climb, decor: THREE.Object3D[]): void {
  const base = (t: Trail, u: number) => trailY(t, u) - 0.02;
  for (const l of f.ledges) {
    const log = f.logs.find((g) => g.trail === l.trail && Math.abs(g.u - l.u) < 1e-6);
    const off = l.off ?? 0, slab = f.slabs.find((s) => s.trail === l.trail && Math.abs(s.u - s.len / 2 - l.u) < 1e-6 && s.off === off);
    // the top you hop up onto, measured like the old course's: the step's top, the slab's top or over the log
    const top = base(l.trail, l.u) + (log ? log.r * 1.9 : slab ? 0.3 : 0);
    const p = trailPoint(l.trail, l.u, off);
    climb.ledges.push({ pos: new THREE.Vector3(p.x, top, p.z), yaw: l.trail.path.at(l.u).yaw, half: l.half, ...(l.log || log ? { log: true } : {}) });
    if (!log) barAcross(w, l.trail, l.u, top + 0.02, l.half, off);
  }
  for (const r of f.rocks) {
    const p = trailPoint(r.trail, r.u, r.off);
    rock(w, p.x, base(r.trail, r.u), p.z, r.r, trailSeed(r.trail, r.u, r.off));
  }
  for (const s of f.slabs) {
    // a flat stone block, its top 0.3 above where it starts, so the trail rising beside it meets its far end
    const p = trailPoint(s.trail, s.u, s.off), y = base(s.trail, s.u - s.len / 2) - 0.2;
    const m = mesh(new THREE.BoxGeometry(s.len, 0.5, s.wid), C.stone, 'ground');
    m.position.set(p.x, y + 0.25, p.z);
    m.rotation.y = s.trail.path.at(s.u).yaw;
    w.add(m);
  }
  for (const g of f.logs) {
    // a log across the whole trail and past its edges: no way round
    const p = trailPoint(g.trail, g.u), m = mesh(new THREE.CylinderGeometry(g.r, g.r * 1.1, 7.4, 10).rotateX(Math.PI / 2), C.trunk, 'rock');
    m.position.set(p.x, base(g.trail, g.u) + g.r * 0.95, p.z);
    m.rotation.y = g.trail.path.at(g.u).yaw + Math.PI; // its thin end on the rider's left, as the old park's lay
    w.add(m);
  }
  for (const j of f.jumps) {
    // lipH is a profile height. The old course put a Line's lip on the profile, 2 cm under the dirt, and the bike's
    // landing help reads lip.y, so it stays there; the bar sits on the dirt.
    const p = trailPoint(j.trail, j.lipU), y = j.trail.y0 - 0.02 + j.lipH, back = j.reverse ? Math.PI : 0;
    barAcross(w, j.trail, j.lipU + (j.reverse ? 0.08 : 0), y + 0.02, j.trail.width / 2); // the bar sits just before the lip, the way it's ridden
    lines.push({ lip: new THREE.Vector3(p.x, y, p.z), yaw: j.trail.path.at(j.lipU).yaw + back, width: j.trail.width, after: 0, land: { knuckle: j.knuckle, length: j.landLen, drop: j.drop } });
  }
  if (!f.gravel.length) return;
  const rnd = pebbleRnd(11), n = 1500, pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.06, 0), mat(0xb9b2a6), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const g = f.gravel[i % f.gravel.length], half = g.trail.width / 2 - 0.1;
    const u = g.u0 + rnd() * (g.u1 - g.u0), off = Math.max(-half, Math.min(half, g.off0 + rnd() * (g.off1 - g.off0)));
    pebbles.setMatrixAt(i, m.compose(trailPoint(g.trail, u, off, 0.02), q.setFromAxisAngle(up, rnd() * 6), one));
  }
  pebbles.receiveShadow = true;
  decor.push(pebbles);
  for (const g of f.gravel) climb.loose.push({ trail: g.trail, u0: g.u0, u1: g.u1, off0: g.off0, off1: g.off1 });
}
