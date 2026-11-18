// Goat Ladder: three steady legs up the hill's gentle face, joined by two tight switchbacks, to the shoulder; then a
// hairpin and a fast descent back down to the trailhead. The profiles and every feature's place along the trail are
// the old park's climb (src/lab/course.ts), so the ride is the same; only where the trail lies on the ground changed.
// Old x-aligned legs become one curved `up` trail. An old sideways dz becomes off = dz * dir (dir +1 rode +x, where +z
// is the rider's right), so features stay on the same side of the rider.
import { Profile, heightAt } from '../../lab/course';
import { TrailPath, type Trail, type TrailFeatures } from '../trail';

export const GOAT_WIDTH = 3;
export const SWITCHBACK_R = 3.5; // as tight as the old switchback pads
const TW = GOAT_WIDTH, Y0 = 0.02; // the old dirt sat 2 cm above the ground; so does this ribbon

// Where the trail starts, at the trailhead, and which way it sets off (yaw 0 is +x). The climb's legs stack toward +z,
// up the hill's gentle face; the descent comes back west above them and bends down to the trailhead. It starts where
// the old park's climb started, so leg 1 (which runs straight, like the old one) gets the very same rocks: a rock's
// lumps come from where it sits, and the robots' line through the rock garden is that fussy.
export const GOAT_START = { x: 52, z: 70, yaw: 0 };
// The gentle bends. Leg 2 swings up away from leg 1 and back (so the hillside between them isn't too steep, and leg 3
// sets off level from the switchback); the descent runs west above leg 3 like the old one, then after its last table
// bends down toward the trailhead for the rest of the way.
const BEND = { R: 30, deg: 24 }, DOWN_BEND = { R: 25, at: 63 }; // at: metres of the descent before it bends

// One leg of the climb, or the descent, as the old course built it: a profile and its features in (u, dz)
interface Leg {
  p: Profile; dir: number; ledges: number[]; gravel: [number, number, number, number][]; rocks: [number, number, number][];
  slabs: [number, number, number, number][]; logs: [number, number][]; jumps: { lipU: number; lipH: number; knuckle: number; landLen: number; drop: number }[];
}
const leg = (h0: number, dir: number): Leg => {
  const p = new Profile();
  p.pts[0] = [0, h0];
  return { p, dir, ledges: [], gravel: [], rocks: [], slabs: [], logs: [], jumps: [] };
};
// a pitch climbing `rise` at `deg`, maybe gravel. (The old course lined gravel pitches with rocks so the grass wasn't a way
// round; on the hill, plant clumps in the tall grass beside them do that: see the hill's trail edges.)
const pitch = (L: Leg, deg: number, rise: number, gravel = false) => {
  const u0 = L.p.u, h = L.p.h;
  L.p.concave(0, deg, 6).slopeTo(deg, h + rise).convex(deg, 0, 6);
  if (gravel) L.gravel.push([u0, L.p.u, -TW / 2 - 0.3, TW / 2 + 0.3]);
};
const ledge = (L: Leg, h: number) => {
  L.p.pts.push([L.p.u, L.p.h + h]);
  L.ledges.push(L.p.u);
};

// The old course's legs, step for step (the old park's climb section, since deleted)
function legs() {
  // leg 1: a pitch, a rock garden to weave through, a ledge, a gravel pitch
  const L1 = leg(0, 1);
  L1.p.flat(8);
  const pitchU = L1.p.u;
  pitch(L1, 9, 1.4);
  L1.p.flat(2);
  const gA = L1.p.u;
  pitch(L1, 4, 0.9);
  L1.rocks.push([gA + 1.5, 0.55, 0.7], [gA + 5, -0.55, 0.75], [gA + 8.5, 0.5, 0.7], [gA + 12, -0.5, 0.65]);
  L1.rocks.push([gA + 3.2, -TW / 2 - 0.6, 0.55], [gA + 6.8, TW / 2 + 0.6, 0.55], [gA + 10.2, -TW / 2 - 0.6, 0.5]);
  L1.p.flat(Math.max(0, gA + 13.5 - L1.p.u));
  L1.p.flat(2);
  ledge(L1, 0.3);
  L1.p.flat(3);
  pitch(L1, 14, 1.6, true);
  L1.p.flat(3);
  // leg 2: a pitch, two steps, then a pitch split down the middle by rocks: gravel all the way up on one side, or hop
  // a ledge (the slab) on the other and ride dirt
  const L2 = leg(L1.p.h, -1);
  L2.p.flat(3);
  pitch(L2, 11, 1.2);
  L2.p.flat(1.5);
  ledge(L2, 0.25);
  L2.p.flat(1.8);
  ledge(L2, 0.3);
  L2.p.flat(3);
  const gB = L2.p.u;
  pitch(L2, 13, 1.5);
  L2.gravel.push([gB, L2.p.u, 0.15, TW / 2 + 0.3]);
  for (let u = gB - 0.4; u < L2.p.u - 0.3; u += 1.5) L2.rocks.push([u, 0, 0.4]);
  let slabEnd = gB;
  while (heightAt(L2.p, slabEnd) < heightAt(L2.p, gB) + 0.3) slabEnd += 0.05;
  L2.slabs.push([(gB - 0.8 + slabEnd) / 2, -0.8, slabEnd - (gB - 0.8), 1.4]);
  L2.p.flat(3);
  // leg 3: a gravel pitch, a narrow gap between two big rocks and one more to dodge, a ledge, the steep punch, the top
  const L3 = leg(L2.p.h, 1);
  L3.p.flat(3);
  pitch(L3, 15, 1.2, true);
  L3.p.flat(2);
  const gC = L3.p.u;
  L3.p.flat(6.5);
  L3.rocks.push([gC + 2.5, -1.25, 0.75], [gC + 2.5, 1.25, 0.75], [gC + 5, 0.7, 0.6]);
  ledge(L3, 0.3);
  L3.p.flat(2.5);
  pitch(L3, 19, 2);
  const topU = L3.p.u + 1.5;
  L3.p.flat(6);
  // the descent: a roll-in, a step-down table, a pitch through a rock garden, a log to hop, a drop onto a slope, a
  // bigger step-down table, then down to the trailhead. Every table lands on more downhill, so going long is fine.
  const D = leg(L3.p.h, -1);
  const down = (deg: number, drop: number, R = 6) => {
    const c = R * (1 - Math.cos((deg * Math.PI) / 180)), h0 = D.p.h;
    D.p.convex(0, -deg, R).slopeTo(-deg, h0 - drop + c).concave(-deg, 0, R);
  };
  const table = (H: number, lip: number, top: number, landDeg: number, step: number) => {
    const h0 = D.p.h;
    D.p.kick(h0 + H, lip);
    const lipU = D.p.u, lipH = D.p.h;
    D.p.flat(top);
    const knuckle = D.p.u;
    D.p.slopeTo(-landDeg, h0 - step).concave(-landDeg, 0, 5);
    D.jumps.push({ lipU, lipH, knuckle, landLen: D.p.u - knuckle, drop: lipH - D.p.h });
  };
  D.p.flat(2);
  down(17, 2.2);
  D.p.flat(2);
  table(0.6, 24, 2.5, 22, 0.9);
  D.p.flat(1.5);
  const gD = D.p.u;
  down(12, 2, 14); // a soft crest, so you can't just fly over the rocks
  // pick a line through the rocks: each row leaves one lane, left, right, left
  for (const [du, side] of [[2, 1], [7, -1], [12, 1]]) D.rocks.push([gD + du, side * 0.5, 0.65], [gD + du, -side * (TW / 2 + 0.55), 0.5]);
  D.p.flat(3);
  D.logs.push([D.p.u - 1.2, 0.23]);
  D.p.flat(2.5);
  D.p.pts.push([D.p.u, D.p.h - 0.7]); // the drop
  D.p.slopeTo(-20, D.p.h - 1).concave(-20, 0, 6);
  D.p.flat(2.5);
  table(0.8, 26, 3, 24, 1);
  D.p.flat(1);
  D.p.convex(0, -16, 6).landing(16, 8).flat(4);
  // leg 1 ran long so the old leg 2 came back to just east of where leg 1 starts; kept, so the climb is as long
  L1.p.flat(Math.max(0, L2.p.u + 7 - L1.p.u));
  return { L1, L2, L3, D, pitchU, topU };
}

// Copy a leg's profile onto the end of a joined one, starting at run u0
const append = (to: Profile, from: Profile, u0: number) => {
  for (const [u, h] of from.pts.slice(1)) to.pts.push([u0 + u, h]);
};

// A leg's features, moved into trail coordinates: u0 is where the leg starts along the trail
function addFeatures(f: TrailFeatures, t: Trail, L: Leg, u0: number): void {
  const d = L.dir;
  for (const u of L.ledges) f.ledges.push({ trail: t, u: u0 + u, half: TW / 2 });
  for (const [u, dz, r] of L.rocks) f.rocks.push({ trail: t, u: u0 + u, off: dz * d, r });
  for (const [a, b, dz0, dz1] of L.gravel) {
    const [off0, off1] = [dz0 * d, dz1 * d].sort((m, n) => m - n);
    f.gravel.push({ trail: t, u0: u0 + a, u1: u0 + b, off0, off1 });
  }
  for (const [u, dz, len, wid] of L.slabs) {
    f.slabs.push({ trail: t, u: u0 + u, off: dz * d, len, wid });
    f.ledges.push({ trail: t, u: u0 + u - len / 2, off: dz * d, half: wid / 2 }); // its near edge, hopped up onto
  }
  for (const [u, r] of L.logs) {
    f.logs.push({ trail: t, u: u0 + u, r });
    f.ledges.push({ trail: t, u: u0 + u, half: TW / 2, log: true });
  }
  for (const j of L.jumps) f.jumps.push({ trail: t, lipU: u0 + j.lipU, lipH: j.lipH, knuckle: j.knuckle - j.lipU, landLen: j.landLen, drop: j.drop });
}

// Where things are along Goat Ladder, for the place that builds it: the climb's start and top lines, the up trail's
// two switchbacks (where each arc starts), and the descent's start and foot lines.
export interface GoatMarks { start: number; top: number; switchbacks: number[]; downStart: number; foot: number; summit: number }

export function goatLadder(): { up: Trail; down: Trail; features: TrailFeatures; marks: GoatMarks } {
  const { L1, L2, L3, D, pitchU, topU } = legs();
  const turn = Math.PI * SWITCHBACK_R; // a half circle
  // up: leg 1, a switchback to the right, leg 2, one to the left, leg 3 (each switchback flat at its leg's height), the
  // same hands as the old pads
  const s = GOAT_START;
  const bend = (BEND.R * BEND.deg * Math.PI) / 180;
  const upPath = new TrailPath(s.x, s.z, s.yaw).straight(L1.p.u)
    .arc(SWITCHBACK_R, -180).arc(BEND.R, BEND.deg).straight(L2.p.u - 2 * bend).arc(BEND.R, -BEND.deg)
    .arc(SWITCHBACK_R, 180).straight(L3.p.u);
  const upProf = new Profile();
  let u = 0;
  const sw: number[] = [];
  for (const L of [L1, L2, L3]) {
    if (L !== L1) {
      sw.push(u);
      upProf.flat(turn);
      u += turn;
    }
    append(upProf, L.p, u);
    u += L.p.u;
  }
  const l3 = u - L3.p.u;
  // down: the summit hairpin (to the right, flat, like the old one), then the descent
  const end = upPath.at(upPath.length), D0 = DOWN_BEND;
  const downPath = new TrailPath(end.x, end.z, end.yaw).arc(SWITCHBACK_R, -180)
    .straight(D0.at).arc(D0.R, (-(D.p.u - D0.at) / D0.R) * (180 / Math.PI));
  const downProf = new Profile();
  downProf.pts[0] = [0, L3.p.h];
  downProf.flat(turn);
  append(downProf, D.p, turn);
  const up: Trail = { id: 'goatUp', path: upPath, profile: upProf, width: TW, y0: Y0 };
  const down: Trail = { id: 'goatDown', path: downPath, profile: downProf, width: TW, y0: Y0 };
  const features: TrailFeatures = { ledges: [], rocks: [], gravel: [], jumps: [], slabs: [], logs: [] };
  addFeatures(features, up, L1, 0);
  addFeatures(features, up, L2, sw[0] + turn);
  addFeatures(features, up, L3, l3);
  addFeatures(features, down, D, turn);
  return { up, down, features, marks: { start: pitchU - 0.5, top: l3 + topU, switchbacks: sw, downStart: turn + 3, foot: turn + D.p.u - 4, summit: turn + 1.5 } };
}
