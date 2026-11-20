// Shredder Hills: one foothill, its land fitted to the trails on it, and a trailhead at the bottom where every trail
// starts or ends (x is east, z is south). Goat Ladder climbs east from the trailhead to the shoulder (12 m) and its
// descent comes back west beside it; Hairpin Hollow zigzags up to the south of it, to the shoulder's south-west end
// (10.7 m), where a spur rides on to the shoulder; a connector (no challenge, just riding) climbs east-north-east along
// the ridge from Goat Ladder's top to the summit (20 m), where Boulder Dash drops west down the ridge's north flank and
// runs out north of Goat Ladder's first leg to the trailhead. The game rides it with ?place=hill until places are wired
// up properly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../../look/palette';
import { mesh, post, rockGeo, bumpers, DIRT, V, Profile, type Area, type BumperKind, type BumperSpot, type Climb, type Course, type Line, type Station } from '../../lab/course';
import { mat } from '../../look/toyLook';
import { car } from '../build';
import { ROUTE } from '../route';
import { makePlan, polyline } from './plan';
import { buildTerrain, type Extent, type HillShape } from '../terrain';
import { edgeBand, gateAcross, obstacleSpans, placeFeatures, trailPoint, trailRibbon, trailSeed, trailY, TrailPath, type Trail, type TrailFeatures } from '../trail';
import { goatLadder, GOAT_WIDTH as TW, SWITCHBACK_R as SR } from '../trails/goatLadder';
import { hairpin, HAIRPIN } from '../trails/hairpin';
import { boulderDash, CHUTE_WIDTH, type BoulderMarks } from '../trails/boulderDash';

const LAND = 0xc8b76c; // the flat past the hill: the same gold as the hill's grass
const GRAVEL = 0xb9b2a6;

// ---- the land

// The hill's natural shape, before it is bent to the trails: a ridge rising from the shoulder (Goat Ladder's top) to the
// summit, and the shoulder running on north to Hairpin Hollow's top. Each is a capsule: its height along its spine,
// easing to nothing `r` metres out, so the land reaches the flat (0) well inside the extent and the edge never shows.
interface Capsule { a: [number, number, number]; b: [number, number, number]; r: number } // [x, z, height] at each end
function capsule(c: Capsule, x: number, z: number): number {
  const [ax, az, ah] = c.a, [bx, bz, bh] = c.b, dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  const s = Math.hypot(x - ax - t * dx, z - az - t * dz) / c.r;
  return s < 1 ? (ah + (bh - ah) * t) * (1 - s * s) ** 2 : 0;
}
const smooth = (a: number) => (a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a));

// Near the trails the natural shape is bent to sit at their height, so the trails lie on the land instead of in cuttings
// and on banks. Each trail point pulls the land by its height difference, fading out over about SIGMA metres; far from
// the trails it is the natural shape. The terrain still cuts the exact bench under each trail.
const SIGMA = 10, PULL_FLOOR = 0.3; // PULL_FLOOR: how many trail points it takes to pull fully (keeps far land natural)
function hillShape(trails: Trail[], natural: (x: number, z: number) => number, flat: (x: number, z: number) => number): HillShape {
  const pts: { x: number; z: number; d: number }[] = [];
  for (const t of trails) for (let u = 0; u <= t.path.length; u += 2) {
    const p = t.path.at(u);
    pts.push({ x: p.x, z: p.z, d: trailY(t, u) - 0.03 - natural(p.x, p.z) });
  }
  const reach2 = (SIGMA * 4) ** 2;
  return {
    height(x, z) {
      let w = 0, d = 0;
      for (const p of pts) {
        const r2 = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (r2 > reach2) continue;
        const k = Math.exp(-r2 / (SIGMA * SIGMA));
        w += k;
        d += k * p.d;
      }
      return Math.max(0, natural(x, z) + d / (w + PULL_FLOOR)) * flat(x, z);
    },
  };
}

// ---- the trailhead

// A gravel lot along the line from Goat Ladder's start to its descent's foot, reaching from Boulder Dash's bottom (past
// the climb's start) to Hairpin Hollow's start (past the descent's foot). along: metres from its middle toward the
// descent's foot; across: to that direction's left (toward the hill; negative is the downhill side).
interface Lot { x: number; z: number; ax: number; az: number; a0: number; a1: number; wid: number }
function lotAlong(a: THREE.Vector3, b: THREE.Vector3, reach: THREE.Vector3[]): Lot {
  const len = Math.hypot(b.x - a.x, b.z - a.z), l: Lot = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, ax: (b.x - a.x) / len, az: (b.z - a.z) / len, a0: -len / 2 - 3, a1: len / 2 + 3, wid: 12 };
  for (const p of reach) {
    const along = (p.x - l.x) * l.ax + (p.z - l.z) * l.az;
    l.a0 = Math.min(l.a0, along - 0.5);
    l.a1 = Math.max(l.a1, along + 1.5);
  }
  return l;
}
// how far (x, z) is outside the lot
const outside = (l: Lot, x: number, z: number) => {
  const dx = x - l.x, dz = z - l.z, along = dx * l.ax + dz * l.az, across = dx * -l.az + dz * l.ax;
  return Math.hypot(Math.max(0, l.a0 - along, along - l.a1), Math.max(0, Math.abs(across) - l.wid / 2));
};
const onLot = (l: Lot, along: number, across: number) => ({ x: l.x + along * l.ax + across * l.az, z: l.z + along * l.az - across * l.ax });

function trailhead(w: THREE.Group, l: Lot, climbStart: THREE.Vector3): void {
  const yaw = Math.atan2(-l.az, l.ax), len = l.a1 - l.a0, mid = onLot(l, (l.a0 + l.a1) / 2, 0); // the lot's long way, as a heading
  const pad = mesh(new THREE.BoxGeometry(len, 0.3, l.wid), C.gravel, 'ground', true);
  pad.position.set(mid.x, 0.01 - 0.15, mid.z);
  pad.rotation.y = yaw;
  w.add(pad);
  // the family car, parked along the downhill side (away from the hill), nose toward the climb
  const c = onLot(l, 2, -3.5);
  car(w, c.x, c.z, yaw + Math.PI, C.suv, false);
  // a split-rail fence along the downhill side, from beside the car to the descent's end of the lot
  const geos: THREE.BufferGeometry[] = [], side = -l.wid / 2 + 0.6, f0 = -2, f1 = 14;
  for (let a = f0; a <= f1 + 0.01; a += 2.4) {
    const p = onLot(l, a, side);
    geos.push(new THREE.CylinderGeometry(0.08, 0.09, 1.15, 6).translate(p.x, 0.575, p.z));
  }
  const fm = onLot(l, (f0 + f1) / 2, side);
  for (const y of [0.5, 0.95]) geos.push(new THREE.BoxGeometry(f1 - f0, 0.09, 0.07).rotateY(yaw).translate(fm.x, y, fm.z));
  w.add(mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), C.wood, 'wall'));
  // the trail sign beside the climb's start: two posts and a board
  const s = { x: climbStart.x - 1.2, z: climbStart.z - TW / 2 - 1.2 };
  for (const d of [-0.5, 0.5]) post(w, s.x + d, s.z, 1.6, 0.06, C.wood, 'wall');
  const board = mesh(new THREE.BoxGeometry(1.4, 0.6, 0.08), C.trunk, 'wall');
  board.position.set(s.x, 1.3, s.z);
  w.add(board);
}

// ---- trail furniture

// a point `along` on from a trail's end (or its start, `fromStart`; negative goes back), `off` to the right, at that
// end's height
function past(t: Trail, along: number, off: number, fromStart = false): THREE.Vector3 {
  const u = fromStart ? 0 : t.path.length, p = t.path.at(u), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return new THREE.Vector3(p.x + along * c + off * s, trailY(t, u), p.z - along * s + off * c);
}

// Rocks along both edges of a trail between u0 and u1, every `step`, merged into one mesh by the caller. skip leaves a
// gap (where another trail joins).
const lineEdges = (geos: THREE.BufferGeometry[], t: Trail, u0: number, u1: number, r = 0.45, step = 0.75, skip?: (p: THREE.Vector3) => boolean) => {
  for (let u = u0; u <= u1; u += step) for (const side of [-1, 1]) {
    const off = side * (t.width / 2 + 0.55), p = trailPoint(t, u, off);
    if (skip?.(p)) continue;
    geos.push(rockGeo(p.x, trailY(t, u) - 0.02, p.z, r, 0.9, trailSeed(t, u, off)));
  }
};

// The arc of radius `radius` starting at u on t: side +1 turns right. Where its middle is, and a point round it.
const arcCentre = (t: Trail, u: number, side: number, radius: number) => trailPoint(t, u, side * radius);

// A Goat Ladder switchback (an arc of radius SR from u along t, turning right when side is +1): a boulder in the middle
// you can't cut across, and plant clumps round the outside so running wide bonks you instead of dropping you off the
// hillside. skip leaves a gap in the clumps (where the connector leaves the summit turn).
function switchback(w: THREE.Group, clumps: BumperSpot[], t: Trail, u: number, side: number, skip?: (p: THREE.Vector3) => boolean): void {
  const c = arcCentre(t, u, side, SR), h = trailY(t, u), off = -side * (TW / 2 + 0.9), n = Math.ceil((Math.PI * (SR + TW / 2 + 0.9)) / 1.25);
  post(w, c.x, c.z, 3.3, SR - TW / 2 - 0.35, C.stone, 'rock', h - 2);
  for (let i = 0; i <= n; i++) {
    const th = 0.15 + ((Math.PI - 0.3) * i) / n, p = trailPoint(t, u + SR * th, off);
    if (!skip?.(p)) clumps.push(clump(p, 0.5, trailSeed(t, u + SR * th, off)));
  }
}

// A Hairpin Hollow switchback, as the old pads had it: the boulder in the middle, and a closed ring of plant clumps round
// the outside, close enough that no bike slips between. side +1 turns left (the hill's Hairpin is the old one's mirror
// image).
function hairpinTurn(w: THREE.Group, clumps: BumperSpot[], t: Trail, u: number, side: number): void {
  const R = HAIRPIN.SR, half = t.width / 2, h = trailY(t, u) - 0.02, c = arcCentre(t, u, -side, R);
  post(w, c.x, c.z, h + 1.1 - (h - 2), R - half - 0.2, C.stone, 'rock', h - 2);
  const r = R + half + 0.55, n = Math.ceil((Math.PI * r) / 1.15), off = side * (r - R);
  for (let k = 0; k <= n; k++) {
    const uu = u + R * ((Math.PI * k) / n);
    clumps.push(clump(trailPoint(t, uu, off), 0.45, trailSeed(t, uu, off)));
  }
}

// ---- trail edges: tall grass beside the trails (a strong drag, so no line beside a trail is quicker than the trail), and
// firm plant clumps where an edge must hold: beside anything on a trail you could ride round, round the outside of the
// switchbacks and round Hairpin Hollow's top platform. Rock lines stay only down Boulder Dash's chute and rock garden.

const KINDS: BumperKind[] = ['yucca', 'cactus', 'bush'];
// a clump at p, standing at p's height (a trail's) until the hill fits it to the land
const clump = (p: THREE.Vector3, r: number, seed: number): BumperSpot => ({ x: p.x, z: p.z, r, kind: KINDS[Math.floor(seed * 3) % 3], y: p.y });
const BAND = 1.6, TUFT = 0xc9b36a, BAND_COL = 0xb4a35f;

// Where each trail runs, for asking which trail a spot beside one belongs to: samples every 0.25 m in 2 m buckets
interface Near { buckets: Map<number, { t: Trail; u: number; x: number; z: number }[]> }
const bucketKey = (x: number, z: number) => Math.floor(x / 2) * 100003 + Math.floor(z / 2);
function nearIndex(trails: Trail[]): Near {
  const buckets: Near['buckets'] = new Map();
  for (const t of trails) for (let u = 0; u <= t.path.length; u += 0.25) {
    const p = t.path.at(u), k = bucketKey(p.x, p.z), b = buckets.get(k);
    if (b) b.push({ t, u, x: p.x, z: p.z }); else buckets.set(k, [{ t, u, x: p.x, z: p.z }]);
  }
  return { buckets };
}
// how far (x, z) is from the edge of any trail but t's own stretch round u (another trail, or t further along it: the
// next leg past a switchback), and from the trailhead lot
function otherEdge(ix: Near, lot: Lot, t: Trail, u: number, x: number, z: number): number {
  let d = outside(lot, x, z);
  const bx = Math.floor(x / 2), bz = Math.floor(z / 2);
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (const s of ix.buckets.get((bx + i) * 100003 + bz + j) ?? []) {
    if (s.t === t && Math.abs(s.u - u) < 3) continue;
    d = Math.min(d, Math.hypot(s.x - x, s.z - z) - s.t.width / 2);
  }
  return d;
}

// The tall grass along both sides of a trail, and the tufts standing in it: each strip reaches BAND metres out, or less
// where it meets the ground that belongs to another trail (halfway between their edges) or the lot, and stops where
// nothing is left. skip(u, side): no grass there (inside a switchback's turn, where the boulder is; along the rock lines).
function bands(geos: THREE.BufferGeometry[], tufts: THREE.Vector3[], ix: Near, lot: Lot, t: Trail, ground: (x: number, z: number) => number, skip?: (u: number, side: number) => boolean): void {
  const half = t.width / 2;
  for (const side of [-1, 1] as const) {
    // how far out the strip can reach at u: to where the ground is as near another trail's edge as this one's
    const room = (u: number) => {
      if (skip?.(u, side)) return 0;
      // (a little past halfway, so two strips meeting there overlap instead of leaving a sliver of hillside between them)
      const mine = (k: number) => { const p = trailPoint(t, u, side * (half + k)); return otherEdge(ix, lot, t, u, p.x, p.z) >= k - 0.15; };
      if (mine(BAND)) return BAND;
      let lo = 0, hi = BAND;
      for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (mine(m)) lo = m; else hi = m; }
      return lo;
    };
    // runs of rows with room, each built as one strip
    let start = -1;
    const widths = new Map<number, number>();
    const flush = (end: number) => {
      if (start >= 0 && end - start > 0.4) {
        const w = (u: number) => { const a = Math.floor(u / 0.5) * 0.5, b = a + 0.5; const wa = widths.get(a) ?? 0, wb = widths.get(b) ?? wa; return wa + (wb - wa) * ((u - a) / 0.5); };
        geos.push(edgeBand(t, side, start, end, w, ground));
        for (let u = start + 0.3; u < end; u += 0.55) {
          const f = Math.abs(Math.sin(u * 91.7 + side * 13.1) * 43758.5) % 1, k = (0.1 + 0.8 * f) * w(u);
          if (k > 0.15) tufts.push(trailPoint(t, u, side * (half + k)).setY(0));
        }
      }
      start = -1;
    };
    for (let u = 0; u <= t.path.length + 1e-9; u += 0.5) {
      const k = room(Math.min(u, t.path.length));
      widths.set(u, k);
      if (k >= 0.3) { if (start < 0) start = u; } else flush(u - 0.5);
    }
    flush(Math.floor(t.path.length / 0.5) * 0.5);
  }
}

// clumps along both edges beside every obstacle span: one every 1.3 m, 0.95 m out past the edge (so the 0.6 m body can't
// slip between them or between them and the trail), clear of other trails; where a rock already sits on the edge the clump
// stands just outside it instead, so the line round the outside of the rock is closed too
function obstacleClumps(clumps: BumperSpot[], f: TrailFeatures, t: Trail, ix: Near, lot: Lot, keep?: (u: number) => boolean): void {
  const R = 0.55, out = t.width / 2 + 0.95;
  const edgeRocks = f.rocks.filter((r) => r.trail.id === t.id && Math.abs(r.off) >= t.width / 2 - 0.2).map((r) => ({ p: trailPoint(t, r.u, r.off), off: r.off, r: r.r }));
  for (const [a, b] of obstacleSpans(f, t, 3)) {
    const n = Math.max(1, Math.round((b - a) / 1.3));
    for (let i = 0; i <= n; i++) for (const side of [-1, 1]) {
      const u = a + ((b - a) * i) / n;
      if (keep && !keep(u)) continue;
      let off = out, p = trailPoint(t, u, side * off);
      const rock = edgeRocks.find((e) => Math.sign(e.off) === side && Math.hypot(e.p.x - p.x, e.p.z - p.z) < e.r + R + 0.1);
      if (rock) { off = Math.max(out, Math.abs(rock.off) + rock.r + R * 0.7); p = trailPoint(t, u, side * off); }
      if (otherEdge(ix, lot, t, u, p.x, p.z) < R + 0.3) continue;
      clumps.push(clump(p, R, trailSeed(t, u, side * off)));
    }
  }
}

// grass tufts standing in the tall grass, a little taller and paler than the hillside's
function tuftMesh(spots: THREE.Vector3[], ground: (x: number, z: number) => number): THREE.InstancedMesh {
  const blades = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2, h = 0.55 + 0.15 * i;
    return new THREE.ConeGeometry(0.06, h, 3, 1, true).translate(0, h / 2, 0).rotateZ(0.3).rotateY(a).toNonIndexed();
  });
  const m = new THREE.InstancedMesh(mergeGeometries(blades), mat(TUFT), Math.max(1, spots.length));
  m.count = spots.length;
  const o = new THREE.Object3D(), c = new THREE.Color();
  spots.forEach((p, i) => {
    const k = (Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1;
    o.position.set(p.x, ground(p.x, p.z), p.z);
    o.rotation.set(0, k * 6.28, 0);
    o.scale.setScalar(0.8 + 0.5 * Math.abs(k));
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(i, c.setHSL(0.13 + 0.02 * k, 0.4, 0.55 + 0.08 * Math.abs(k)));
  });
  m.receiveShadow = true;
  return m;
}

// a yellow strip across the trail where a timed run starts or ends
function mark(w: THREE.Group, t: Trail, u: number): void {
  const p = trailPoint(t, u), m = mesh(new THREE.BoxGeometry(0.3, 0.025, t.width), C.lip, undefined, true);
  m.position.set(p.x, p.y + 0.0125, p.z);
  m.rotation.y = t.path.at(u).yaw;
  w.add(m);
}

// ---- the connector: from Goat Ladder's top (leaving its summit turn straight out from the middle of the turn) up to the
// summit, arriving on Boulder Dash's start deck from its left side

// straight, a long gentle left, straight, a tighter left onto the deck: the first bend's angle and the straight between
// are solved so the trail ends exactly on the deck, heading straight across it
function connectorPath(from: { x: number; z: number; yaw: number }, to: { x: number; z: number; yaw: number }, R1 = 60, R2 = 22, lead = 10): TrailPath {
  const turn = to.yaw - from.yaw;
  // the end point for a first bend of a radians, with the straight between the bends set to land on the right line
  const build = (a: number, b: number) => new TrailPath(from.x, from.z, from.yaw).straight(lead).arc(R1, (a * 180) / Math.PI).straight(b).arc(R2, ((turn - a) * 180) / Math.PI);
  // the straight b closes the distance along the line toward `to`; a is found by bisection on the sideways miss
  const miss = (a: number) => {
    const p0 = build(a, 0), e = p0.at(p0.length), dir = from.yaw + a, fx = Math.cos(dir), fz = -Math.sin(dir);
    // sliding the second bend along the straight moves the end along (fx, fz): choose b to get as close as possible
    const b = Math.max(0, (to.x - e.x) * fx + (to.z - e.z) * fz);
    const ex = e.x + b * fx, ez = e.z + b * fz;
    return { b, side: (to.x - ex) * -fz + (to.z - ez) * fx };
  };
  let lo = 0.05, hi = turn - 0.05;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (Math.sign(miss(m).side) === Math.sign(miss(lo).side)) lo = m; else hi = m;
  }
  const a = (lo + hi) / 2;
  return build(a, miss(a).b);
}

// The connector's height: level out of the summit turn, two steady pitches, level onto the deck (the spur's: one gentle
// pitch, `pitches` 1)
function connectorProfile(len: number, h0: number, h1: number, pitches = 2, flat0 = 10, flat1 = 16): Profile {
  const p = new Profile(), mid = pitches > 1 ? 8 : 0, rise = (h1 - h0) / pitches;
  p.pts[0] = [0, h0];
  const run = (len - flat0 - mid - flat1) / pitches, deg = (Math.atan(rise / (run - 4)) * 180) / Math.PI;
  const pitch = () => {
    const h = p.h + rise - 12 * (1 - Math.cos((deg * Math.PI) / 180)); // where the slope ends, so the crest tops out at +rise
    p.concave(0, deg, 12).slopeTo(deg, h).convex(deg, 0, 12);
  };
  p.flat(flat0);
  pitch();
  if (pitches > 1) {
    p.flat(mid);
    pitch();
  }
  p.flat(Math.max(0, len - p.u));
  return p;
}

// ---- the place

export function buildHill(): Course {
  const w = new THREE.Group(), lines: Line[] = [], decor: THREE.Object3D[] = [];
  const goat = goatLadder(), hp = hairpin(), bd = boulderDash();
  const { up, down, marks } = goat, hpt = hp.trail, chute = bd.trail;
  const turn = Math.PI * SR, H = HAIRPIN;

  // Hairpin Hollow's top: a dirt platform past the end of leg 5 to turn round on (Hairpin ↕), reaching out on the side
  // away from leg 4, as the old one did (here leg 4 is on the rider's right, so it reaches left)
  const legEnd = hp.marks.legs[4][1], topH = trailY(hpt, legEnd) - hpt.y0;
  const plat = { len: 6.55, left: 4.5, right: H.width / 2 + 0.55 + 0.45 }; // the old platform's size
  // it starts 5 cm before the trail's end (as the old one overlapped the leg), its middle (right - left)/2 to the right
  const py = hpt.path.at(legEnd).yaw, platC = past(hpt, -0.05, (plat.right - plat.left) / 2);
  const platProf = new Profile();
  platProf.pts[0] = [0, topH];
  platProf.flat(plat.len);
  const top: Trail = { id: 'hairpinTop', path: new TrailPath(platC.x, platC.z, py).straight(plat.len), profile: platProf, width: plat.left + plat.right, y0: hpt.y0 };

  // the connector, from the middle of Goat Ladder's summit turn straight out, to Boulder Dash's deck at u 1.5
  const apex = down.path.at(turn / 2), join = 1.5, deck = chute.path.at(join);
  const cPath = connectorPath({ x: apex.x, z: apex.z, yaw: apex.yaw + Math.PI / 2 }, { x: deck.x, z: deck.z, yaw: deck.yaw - Math.PI / 2 });
  const conn: Trail = { id: 'connector', path: cPath, width: 3, y0: up.y0, profile: connectorProfile(cPath.length, trailY(up, up.path.length) - up.y0, trailY(chute, 0) - up.y0) };
  const onConn = (p: THREE.Vector3) => conn.path.nearest(p.x, p.z).dist < conn.width / 2 + 0.9;

  // the spur (dirt, no run, like the connector): off Hairpin Hollow's top platform from its middle, out of its wide side,
  // round to the connector where the Shoulder station stands, so Hairpin's top isn't a dead end
  const SPUR_JOIN = 5, spurFrom = trailPoint(top, top.path.length / 2), spurTo = conn.path.at(SPUR_JOIN);
  const sPath = connectorPath({ x: spurFrom.x, z: spurFrom.z, yaw: py + Math.PI / 2 }, { x: spurTo.x, z: spurTo.z, yaw: spurTo.yaw + Math.PI / 2 }, 25, 15, 4);
  const spur: Trail = { id: 'spur', path: sPath, width: 3, y0: hpt.y0, profile: connectorProfile(sPath.length, topH, trailY(conn, SPUR_JOIN) - hpt.y0, 1, 8, 12) };
  const onSpur = (p: THREE.Vector3) => spur.path.nearest(p.x, p.z).dist < spur.width / 2 + 0.9;

  const trails = [up, down, hpt, top, chute, conn, spur];
  const lot = lotAlong(trailPoint(up, 0), trailPoint(down, down.path.length), [trailPoint(hpt, 0), trailPoint(chute, chute.path.length)]);

  // the land: the hill (flat under the lot), and the flat beyond it so riding off the edge never falls through
  // the ridge's spine ends south of Boulder Dash (+z), so the chute runs down the ridge's north flank, where the land
  // falls away from the spine as fast as the chute drops
  const ridge: Capsule = { a: [apex.x + 2, apex.z - 2, 12.5], b: [deck.x + 6, deck.z + 12, 19.6], r: 45 };
  const shoulder: Capsule = { a: [apex.x - 2, apex.z + 6, 12], b: [hpt.path.at(legEnd).x + 4, hpt.path.at(legEnd).z - 6, 11], r: 45 };
  // the summit itself: the deck and the chute's first steep pitch sit on a knob of their own, so the ground beside them
  // holds the trail's height on both sides (the ridge alone left the north side of the deck 2 m low)
  const along = (t: Trail, u0: number, u1: number, r: number, lift: number): Capsule => {
    const a = u0 < 0 ? past(t, u0, 0, true) : t.path.at(u0), b = t.path.at(u1);
    return { a: [a.x, a.z, trailY(t, Math.max(0, u0)) + lift], b: [b.x, b.z, trailY(t, u1) + lift], r };
  };
  const summit = [along(chute, -4, 6, 45, 0.5), along(chute, 7, bd.marks.aEnd, 45, 0.3)];
  // and Hairpin Hollow's top platform the same, so the hillside beside it doesn't sag away below the turnaround
  const knobs = [...summit, along(top, -1, top.path.length + 1, 45, 0.4)];
  const caps = [ridge, shoulder, ...knobs];
  const natural = (x: number, z: number) => Math.max(...caps.map((c) => capsule(c, x, z)));
  const shape = hillShape(trails, natural, (x, z) => smooth(outside(lot, x, z) / 6));
  const extent = extentOf(trails, caps);
  const terrain = buildTerrain(trails, shape, extent);
  w.add(terrain.mesh);
  const flat = mesh(new THREE.BoxGeometry(1200, 0.5, 1200), LAND, 'grass', true);
  flat.position.set((extent.x0 + extent.x1) / 2, -0.03 - 0.25, (extent.z0 + extent.z1) / 2);
  w.add(flat);
  trailhead(w, lot, trailPoint(up, 0));

  // the riding surfaces, and every trail's features (one pass, so the gravel's pebbles are one mesh)
  for (const t of trails) w.add(mesh(trailRibbon(t), DIRT, 'dirt', true));
  const climb: Climb = {
    // (it stops just short of the climb's end: past a trail's end its nearest point is the end, so a zone reaching the
    // end would carry on round the summit turn; the old park's climb stopped where the climb did)
    area: [{ trail: up, u0: marks.start - 0.5, u1: up.path.length - 0.01, off0: -SR, off1: SR, up: 1 }],
    loose: [], ledges: [],
    // like the old park's, these read forward riding down (the climb counts them crossed going up)
    start: gateAcross(up, marks.start, 2, true),
    top: gateAcross(up, marks.top, 2, true),
  };
  // every Hairpin leg climbs, ridden up (the old park's leg boxes reached a metre past each end); ridden down it's a
  // descent, the same trail
  for (const [u0, u1] of hp.marks.legs) climb.area.push({ trail: hpt, u0: u0 - 1, u1: u1 + 1, off0: -2, off1: 2, up: 1 });
  const all: TrailFeatures = { ledges: [], rocks: [], gravel: [], jumps: [], slabs: [], logs: [] };
  for (const f of [goat.features, hp.features, bd.features]) for (const k of Object.keys(all) as (keyof TrailFeatures)[]) (all[k] as unknown[]).push(...f[k]);
  placeFeatures(w, all, lines, climb, decor);
  // the old Hairpin's gravel was a pale strip laid on the pitch, a little proud of the dirt
  w.add(mesh(trailRibbon({ ...hpt, y0: hpt.y0 + 0.015 }, { u0: hp.marks.gravel[0], u1: hp.marks.gravel[1], skirt: 0.02 }), GRAVEL, 'dirt', true));

  // the edges: rock lines down the chute, tall grass along everything else, plant clumps where an edge must hold
  const edges: THREE.BufferGeometry[] = [], clumps: BumperSpot[] = [], grass: THREE.BufferGeometry[] = [], tufts: THREE.Vector3[] = [];
  const ix = nearIndex(trails), ground = terrain.heightAt;
  goatFurniture(w, clumps, goat, onConn);
  hairpinFurniture(w, clumps, hp, top, onSpur);
  chuteFurniture(edges, chute, bd.marks, onConn);
  w.add(mesh(mergeGeometries(edges), C.stone, 'rock'));
  const rocky = (u: number) => u < bd.marks.bEnd; // Boulder Dash's chute and rock garden keep their rock lines
  for (const t of [up, down, hpt, chute]) obstacleClumps(clumps, all, t, ix, lot, t === chute ? (u) => !rocky(u) : undefined);
  // no grass inside a switchback's turn (its boulder is there), nor beside the chute's rock lines
  const turns: [Trail, number, number, number][] = [ // trail, where the turn starts, its length, the side its middle is on
    [up, marks.switchbacks[0], turn, 1], [up, marks.switchbacks[1], turn, -1], [down, 0, turn, 1],
    ...hp.marks.switchbacks.map((u, i): [Trail, number, number, number] => [hpt, u, Math.PI * H.SR, i % 2 ? 1 : -1]),
  ];
  const inside = (t: Trail) => (u: number, side: number) => turns.some(([tt, u0, len, s]) => tt === t && s === side && u > u0 - 0.5 && u < u0 + len + 0.5);
  for (const t of [up, down, hpt, conn, spur]) bands(grass, tufts, ix, lot, t, ground, inside(t));
  bands(grass, tufts, ix, lot, chute, ground, (u) => rocky(u + 0.5));
  w.add(mesh(mergeGeometries(grass), BAND_COL, 'tallgrass', true));
  decor.push(tuftMesh(tufts, ground));
  // each clump stands on the land, or at its trail's height where the land falls away below the trail's edge
  for (const c of clumps) if (c.y !== undefined) c.y = Math.max(ground(c.x, c.z), c.y - 0.03);
  const plants = bumpers(clumps, { firm: true, ground });
  if (plants.solid) w.add(plants.solid);
  decor.push(...plants.meshes);
  for (const [t, u] of [[up, marks.start], [up, marks.top], [down, marks.foot], [hpt, hp.marks.bottom], [hpt, hp.marks.top], [chute, bd.marks.finishU]] as const) mark(w, t, u);

  // the timed runs: Goat Ladder's (up the climb, down the descent, both), Hairpin Hollow's (up, the same trail back down,
  // both), and Boulder Dash
  const half = TW / 2 + 0.5, hh = H.width / 2 + 0.5, ch = CHUTE_WIDTH / 2 + 0.5;
  const hpBottom = gateAcross(hpt, hp.marks.bottom, hh), hpTop = gateAcross(hpt, hp.marks.top, hh);
  // each run's route: the trail it follows in riding order. Hairpin ↕ turns round on the top platform, past the top mark,
  // which counts as on the route but gives no progress
  const hb = hp.marks.bottom, ht = hp.marks.top, edge = H.width / 2 + ROUTE.lateral;
  const runs: Course['runs'] = {
    goatUp: { start: gateAcross(up, marks.start, 2), finish: gateAcross(up, marks.top, 2), route: { legs: [{ trail: up, u0: marks.start, u1: marks.top }] } },
    goatDown: { start: gateAcross(down, marks.downStart, half), finish: gateAcross(down, marks.foot, half), route: { legs: [{ trail: down, u0: marks.downStart, u1: marks.foot }] } },
    goatBoth: {
      start: gateAcross(up, marks.start, 2), finish: gateAcross(down, marks.foot, half),
      route: { legs: [{ trail: up, u0: marks.start, u1: up.path.length }, { trail: down, u0: 0, u1: marks.foot }], top: marks.top - marks.start },
    },
    hairpinUp: { start: hpBottom, finish: hpTop, route: { legs: [{ trail: hpt, u0: hb, u1: ht }] } },
    hairpinDown: { start: gateAcross(hpt, ht, hh, true), finish: gateAcross(hpt, hb, hh, true), route: { legs: [{ trail: hpt, u0: ht, u1: hb }] } },
    hairpinBoth: {
      start: hpBottom, finish: gateAcross(hpt, hb, hh, true),
      route: {
        legs: [{ trail: hpt, u0: hb, u1: ht }, { trail: hpt, u0: ht, u1: hb }],
        top: ht - hb,
        also: [{ trail: hpt, u0: ht, u1: hpt.path.length, off0: -edge, off1: edge }, { trail: top, u0: 0, u1: top.path.length, off0: -(top.width / 2 + ROUTE.lateral), off1: top.width / 2 + ROUTE.lateral }],
      },
    },
    boulderDash: { start: gateAcross(chute, bd.marks.startU + 1, ch), finish: gateAcross(chute, bd.marks.finishU, ch), route: { legs: [{ trail: chute, u0: bd.marks.startU + 1, u1: bd.marks.finishU }] } },
  };

  // Stations stand on their trail, 2 cm up, facing along it (or back down it, where a run is ridden in reverse)
  const at = (t: Trail, u: number, reverse = false): Station => ({ pos: trailPoint(t, u, 0, 0.02), yaw: t.path.at(u).yaw + (reverse ? Math.PI : 0) });
  // the trailhead: on the lot, clear of Goat Ladder's ring, facing up the climb's first leg
  const th = past(up, -6, 2, true);
  const stations: Record<string, Station> = {
    Trailhead: { pos: V(th.x, 0.04, th.z), yaw: up.path.at(0).yaw },
    Climb: at(up, 1),
    Summit: at(down, marks.summit), // Goat Ladder's top, on the shoulder: the top of the descent, facing down
    Switchbacks: at(hpt, hp.marks.station),
    'Switchbacks top': at(hpt, hp.marks.topStation, true),
    'Rock chute': at(chute, 1.5), // the summit: Boulder Dash's start
    Shoulder: at(conn, 5), // the connector's foot, just out of Goat Ladder's summit turn
    Hilltop: at(conn, conn.path.length - 10), // nearly at the summit, Boulder Dash's deck just ahead
  };
  // each spot's area: the hillside its trails cover
  const goatZone = box([up, down], 8), hpZone = box([hpt, top], 6), chuteZone = box([chute], 8);
  const ring = (s: Station) => ({ x: s.pos.x, z: s.pos.z });
  // the scenery plan: trails (to their edges), the lot, lips, plants, stations and rings stay clear
  const blockers = { segs: [] as number[][], rects: [] as number[][], discs: [] as number[][] };
  for (const t of trails) {
    const pts: { x: number; z: number }[] = [];
    for (let u = 0; u < t.path.length; u += 1) pts.push(t.path.at(u));
    pts.push(t.path.at(t.path.length));
    blockers.segs.push(...polyline(pts, t.width / 2));
  }
  const lotA = onLot(lot, lot.a0, 0), lotB = onLot(lot, lot.a1, 0);
  blockers.segs.push([lotA.x, lotA.z, lotB.x, lotB.z, lot.wid / 2]);
  for (const l of lines) blockers.discs.push([l.lip.x, l.lip.z, l.width / 2 + 1]);
  for (const c of plants.spots) blockers.discs.push([c.x, c.z, c.r + 0.5]);
  for (const s of Object.values(stations)) blockers.discs.push([s.pos.x, s.pos.z, 1.5]);
  const rings = { Climb: ring(stations.Climb), Summit: ring(stations.Summit), Switchbacks: ring(stations.Switchbacks), 'Switchbacks top': ring(stations['Switchbacks top']), 'Rock chute': ring(stations['Rock chute']) };
  for (const c of Object.values(rings)) blockers.discs.push([c.x, c.z, 3]);
  const scenery = makePlan({ seed: 42, extent, ground: terrain.heightAt, blockers, home: stations.Trailhead.pos, insideGroves: 0.5 });
  return {
    world: w, decor, lines, gates: [], bumpers: plants, stations, coast: [], climb, rough: bd.rough, runs,
    place: 'shredderHills', home: 'Trailhead',
    trails: { goatUp: up, goatDown: down, hairpin: hpt, hairpinTop: top, boulderDash: chute, connector: conn, spur },
    rings,
    zones: { Climb: goatZone, Summit: goatZone, Switchbacks: hpZone, 'Switchbacks top': hpZone, 'Rock chute': chuteZone },
    ground: terrain.heightAt,
    scenery,
  };
}

// the box round some trails, `pad` metres out
function box(trails: Trail[], pad: number): Area {
  const b = new THREE.Box2();
  for (const t of trails) for (let u = 0; u <= t.path.length; u += 1) { const p = t.path.at(u); b.expandByPoint(new THREE.Vector2(p.x, p.z)); }
  return { x0: b.min.x - pad, x1: b.max.x + pad, z0: b.min.y - pad, z1: b.max.y + pad };
}

// The terrain's extent: past every trail by the reach of the pull toward it, and past every capsule's edge, so the land
// is back on the flat at the edge
function extentOf(trails: Trail[], caps: Capsule[]): Extent {
  const b = box(trails, SIGMA * 4 + 6);
  for (const c of caps) for (const [x, z] of [c.a, c.b]) {
    b.x0 = Math.min(b.x0, x - c.r - 3); b.x1 = Math.max(b.x1, x + c.r + 3);
    b.z0 = Math.min(b.z0, z - c.r - 3); b.z1 = Math.max(b.z1, z + c.r + 3);
  }
  return b;
}

// Goat Ladder's switchbacks and summit turn (with a gap in its clumps where the connector leaves), and a row of clumps
// across the grass beside the run-up, where the climb is first high enough to ride onto from the trailhead
function goatFurniture(w: THREE.Group, clumps: BumperSpot[], g: ReturnType<typeof goatLadder>, onConn: (p: THREE.Vector3) => boolean): void {
  const { up, down, marks } = g;
  let uc = marks.start - 0.5;
  while (trailY(up, uc) < 0.57) uc += 0.1;
  for (const side of [-1, 1]) for (let off = TW / 2 + 0.85; off < 7.5; off += 1.1) clumps.push({ ...clump(trailPoint(up, uc, side * off), 0.45, trailSeed(up, uc, side * off)), y: undefined });
  switchback(w, clumps, up, marks.switchbacks[0], 1);
  switchback(w, clumps, up, marks.switchbacks[1], -1);
  switchback(w, clumps, down, 0, 1, onConn);
}

// Hairpin Hollow's four switchbacks, and clumps round its top platform: just inside every edge, so riding on past the
// finish doesn't run you off down the hillside, open where the spur leaves its wide side
function hairpinFurniture(w: THREE.Group, clumps: BumperSpot[], hp: ReturnType<typeof hairpin>, top: Trail, onSpur: (p: THREE.Vector3) => boolean): void {
  const t = hp.trail, half = t.width / 2;
  hp.marks.switchbacks.forEach((u, i) => hairpinTurn(w, clumps, t, u, i % 2 ? -1 : 1));
  // on the platform trail: off is measured from its middle, which sits (left - right)/2 to the left of the trail's
  const shift = (top.width / 2 - (half + 0.55 + 0.45)), edge = half + 0.55;
  const at = (along: number, off: number) => clumps.push(clump(trailPoint(top, along, off + shift), 0.45, trailSeed(top, along, off)));
  const far = top.path.length - 0.45, wide = -(top.width - (half + 0.55 + 0.45)) + 0.45; // the far end, and the left edge's line
  for (let a = 0.05; a <= far + 0.01; a += 1.1) {
    at(a, edge);
    if (!onSpur(trailPoint(top, a, wide + shift))) at(a, wide);
  }
  for (let off = edge - 1.1; off >= wide + 0.3; off -= 1.1) at(far, off);
  at(far, wide);
  for (let off = -edge; off >= wide - 0.01; off -= 1.1) at(0.5, off);
}

// Boulder Dash's edge rocks down the chute and through the rock garden (with a gap on the deck where the connector
// arrives), and the deck's back edge, so nobody rolls off behind the start
function chuteFurniture(edges: THREE.BufferGeometry[], t: Trail, m: BoulderMarks, onConn: (p: THREE.Vector3) => boolean): void {
  lineEdges(edges, t, 0, m.bEnd, 0.45, 0.75, onConn);
  for (let off = -t.width / 2; off <= t.width / 2 + 0.01; off += 0.7) {
    const p = past(t, -0.5, off, true);
    edges.push(rockGeo(p.x, trailY(t, 0) - 0.02, p.z, 0.45, 0.9, trailSeed(t, -0.5, off)));
  }
}

