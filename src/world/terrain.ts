// The hill surface: a grid of heights that follows the natural hill everywhere except near a trail, where it drops
// onto a flat-ish bench just under the ribbon and blends back out. One rule fits any set of trails.
import * as THREE from 'three';
import { trailPoint, trailY, type Trail } from './trail';

export interface HillShape { height(x: number, z: number): number }
export interface Extent { x0: number; x1: number; z0: number; z1: number }

const SINK = 0.03;      // the ground sits this far under the ribbon so the ribbon never z-fights with it
const BENCH = 1.5;      // flat ground out past the ribbon's edge
const BLEND = 4;        // then it eases back to the natural hill over this far
const BUCKET = 2;       // the nearest-trail lookup grid
const STRIDE = 0.5;     // trail samples every half metre are plenty for the lookup
const GOLD = 0xc8b76c, SAGE = 0xa3a675, DRY = 0xd8c98a;

// where a trail runs, as samples dropped into a coarse bucket grid
interface Sample { x: number; z: number; u: number }
interface Index { buckets: Map<number, { t: number; i: number }[]>; samples: Sample[][]; reach: number }

const key = (bx: number, bz: number) => bx * 100003 + bz;

function indexTrails(trails: Trail[]): Index {
  const buckets = new Map<number, { t: number; i: number }[]>(), samples: Sample[][] = [];
  let reach = 0;
  trails.forEach((tr, t) => {
    const list: Sample[] = [], n = Math.max(1, Math.ceil(tr.path.length / STRIDE));
    for (let k = 0; k <= n; k++) {
      const u = (tr.path.length * k) / n, p = tr.path.at(u);
      list.push({ x: p.x, z: p.z, u });
      const kk = key(Math.floor(p.x / BUCKET), Math.floor(p.z / BUCKET));
      const b = buckets.get(kk);
      if (b) b.push({ t, i: k }); else buckets.set(kk, [{ t, i: k }]);
    }
    samples.push(list);
    reach = Math.max(reach, influence(tr));
  });
  return { buckets, samples, reach };
}

// how far from the centreline a trail still changes the ground
const influence = (t: Trail) => t.width / 2 + BENCH + BLEND;
// the clamp reaches a grid step or so past the ribbon, so a triangle spanning the ribbon edge can't poke through
const clampReach = (t: Trail, cell: number) => t.width / 2 + 0.3 + cell * 1.5;

// Where the profile jumps (a ledge up or a drop), the ground must follow the LOWER side for a little way either way.
// Otherwise a vertex just past a step-up is high and the triangle back to its low neighbour is a ramp rising above
// the ribbon, which the physics would feel as a ramp in front of the ledge (or a lip after a drop).
const EPS = 1e-6;
const stepsOf = (t: Trail): number[] => {
  const out: number[] = [], p = t.profile.pts;
  for (let i = 1; i < p.length; i++) if (Math.abs(p[i][0] - p[i - 1][0]) < EPS && p[i][1] !== p[i - 1][1]) out.push(p[i][0]);
  return out;
};
// Over a concave stretch the straight line between two grid vertices sits above the curve (about L²/8R, which is more
// than SINK for a tight landing). So the ground also follows the lowest point of the profile in a window, measured
// against the local slope: on a steady slope that is just the height at u, over a dip it drops by the sag.
const WINDOW_STEP = 0.25;
function benchHeight(t: Trail, steps: number[], u: number, cell: number): number {
  const w = cell * 1.5, top = t.path.length, at = (v: number) => trailY(t, Math.max(0, Math.min(top, v)));
  // near a trail's end the window is cut short, so measure the slope over what is left
  const lo = Math.max(0, u - w), hi = Math.min(top, u + w), slope = hi > lo ? (at(hi) - at(lo)) / (hi - lo) : 0;
  let y = at(u);
  for (let v = u - w; v <= u + w + 1e-9; v += WINDOW_STEP) y = Math.min(y, at(v) - slope * (Math.max(0, Math.min(top, v)) - u));
  for (const s of steps) {
    if (Math.abs(s - u) > w) continue;
    y = Math.min(y, trailY(t, s - EPS), trailY(t, s + EPS));
  }
  return y - SINK;
}

const smooth = (a: number) => a * a * (3 - 2 * a);

// the nearest point on each trail within `reach`: its distance and how far along it is
function nearTrails(ix: Index, x: number, z: number): Map<number, { dist: number; u: number }> {
  const out = new Map<number, { dist: number; u: number }>(), r = Math.ceil(ix.reach / BUCKET) + 1;
  const bx = Math.floor(x / BUCKET), bz = Math.floor(z / BUCKET);
  const best = new Map<number, { i: number; d: number }>();
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
    const b = ix.buckets.get(key(bx + i, bz + j));
    if (!b) continue;
    for (const { t, i: k } of b) {
      const s = ix.samples[t][k], d = Math.hypot(s.x - x, s.z - z), cur = best.get(t);
      if (!cur || d < cur.d) best.set(t, { i: k, d });
    }
  }
  for (const [t, { i }] of best) {
    // refine on the two segments either side of the closest sample
    const list = ix.samples[t];
    let dist = Infinity, u = list[i].u;
    for (const [a, b] of [[i - 1, i], [i, i + 1]]) {
      if (a < 0 || b >= list.length) continue;
      const sa = list[a], sb = list[b], dx = sb.x - sa.x, dz = sb.z - sa.z, len2 = dx * dx + dz * dz;
      const f = len2 > 0 ? Math.max(0, Math.min(1, ((x - sa.x) * dx + (z - sa.z) * dz) / len2)) : 0;
      const d = Math.hypot(x - sa.x - f * dx, z - sa.z - f * dz);
      if (d < dist) { dist = d; u = sa.u + f * (sb.u - sa.u); }
    }
    if (dist === Infinity) dist = best.get(t)!.d;
    out.set(t, { dist, u });
  }
  return out;
}

// the ground height at one grid vertex
function vertexHeight(trails: Trail[], steps: number[][], ix: Index, shape: HillShape, cell: number, x: number, z: number): number {
  const natural = shape.height(x, z);
  // each trail pulls the ground to its bench (filling as well as cutting); where several reach, the lowest wins
  let h = Infinity, cap = Infinity;
  for (const [t, { dist, u }] of nearTrails(ix, x, z)) {
    const tr = trails[t], bench = benchHeight(tr, steps[t], u, cell), half = tr.width / 2;
    if (dist > influence(tr) && dist > clampReach(tr, cell)) continue;
    const past = (dist - half - BENCH) / BLEND; // 0 at the bench's edge, 1 where the natural hill is back
    if (past < 1) h = Math.min(h, past <= 0 ? bench : bench + (natural - bench) * smooth(past));
    if (dist <= clampReach(tr, cell)) cap = Math.min(cap, bench);
  }
  return Math.min(h === Infinity ? natural : h, cap);
}

// a cheap steady scatter (no Math.random, so every build looks the same)
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number, z: number) => {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
};

const SAGE_C = new THREE.Color(SAGE), DRY_C = new THREE.Color(DRY);
function paint(x: number, z: number, c: THREE.Color): void {
  const n = vnoise(x / 40, z / 40) * 0.6 + vnoise(x / 15, z / 15) * 0.4;
  c.set(GOLD).lerp(n > 0.55 ? SAGE_C : DRY_C, Math.min(1, Math.abs(n - 0.5) * 1.6));
}

// The bench is a good guess, but a triangle is flat and the trail isn't: where its corners straddle a concave curve
// (a kick's bottom, a landing), or its diagonal cuts across one slantwise, it can still come up through the ribbon.
// So last, walk every ribbon closely and wherever the ground comes within SINK of it, lower that triangle's corners
// by the difference. It only ever lowers, so one pass holds; a few millimetres between samples is well inside SINK.
const CHECK = 0.1;
function keepUnder(trails: Trail[], pos: Float32Array, extent: Extent, cell: number, nx: number, nz: number): void {
  const vx = nx + 1, at = (i: number, j: number) => (j * vx + i) * 3 + 1;
  for (const t of trails) {
    const half = t.width / 2 + 0.3; // and a little past each edge, under the skirt
    for (let u = 0; u <= t.path.length + 1e-9; u += CHECK) {
      const want = trailY(t, Math.min(u, t.path.length)) - SINK;
      for (let off = -half; off <= half + 1e-9; off += CHECK) {
        const p = trailPoint(t, Math.min(u, t.path.length), off);
        const gx = (p.x - extent.x0) / cell, gz = (p.z - extent.z0) / cell;
        if (gx < 0 || gz < 0 || gx > nx || gz > nz) continue;
        const i = Math.min(nx - 1, Math.floor(gx)), j = Math.min(nz - 1, Math.floor(gz)), fx = gx - i, fz = gz - j;
        // the triangle under the point and how much each corner counts, as heightAt reads the mesh
        const tri: [number, number][] = fx + fz <= 1
          ? [[at(i, j), 1 - fx - fz], [at(i + 1, j), fx], [at(i, j + 1), fz]]
          : [[at(i + 1, j + 1), fx + fz - 1], [at(i, j + 1), 1 - fx], [at(i + 1, j), 1 - fz]];
        const y = tri.reduce((sum, [k, w]) => sum + pos[k] * w, 0);
        if (y > want) for (const [k] of tri) pos[k] -= y - want;
      }
    }
  }
}

export function buildTerrain(
  trails: Trail[], shape: HillShape, extent: Extent, cell = 1.5,
): { mesh: THREE.Mesh; heightAt(x: number, z: number): number } {
  const nx = Math.ceil((extent.x1 - extent.x0) / cell), nz = Math.ceil((extent.z1 - extent.z0) / cell);
  const vx = nx + 1, vz = nz + 1, ix = indexTrails(trails), steps = trails.map(stepsOf);
  const pos = new Float32Array(vx * vz * 3), col = new Float32Array(vx * vz * 3), c = new THREE.Color();
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const x = extent.x0 + i * cell, z = extent.z0 + j * cell, k = (j * vx + i) * 3;
    pos.set([x, vertexHeight(trails, steps, ix, shape, cell, x, z), z], k);
    paint(x, z, c);
    col.set([c.r, c.g, c.b], k);
  }
  keepUnder(trails, pos, extent, cell, nx, nz);
  const index = new Uint32Array(nx * nz * 6);
  let n = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i, b = a + 1, d = a + vx, e = d + 1; // a b over d e; the diagonal runs b to d
    index.set([a, d, b, b, d, e], n);
    n += 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  mesh.userData.collide = 'grass';

  // the same surface the triangles make, so riding and drawing agree
  const h = (i: number, j: number) => pos[(Math.max(0, Math.min(nz, j)) * vx + Math.max(0, Math.min(nx, i))) * 3 + 1];
  const heightAt = (x: number, z: number): number => {
    const gx = Math.max(0, Math.min(nx, (x - extent.x0) / cell)), gz = Math.max(0, Math.min(nz, (z - extent.z0) / cell));
    const i = Math.min(nx - 1, Math.floor(gx)), j = Math.min(nz - 1, Math.floor(gz)), fx = gx - i, fz = gz - j;
    if (fx + fz <= 1) return h(i, j) + fx * (h(i + 1, j) - h(i, j)) + fz * (h(i, j + 1) - h(i, j));
    return h(i + 1, j + 1) + (1 - fx) * (h(i, j + 1) - h(i + 1, j + 1)) + (1 - fz) * (h(i + 1, j) - h(i + 1, j + 1));
  };
  return { mesh, heightAt };
}
