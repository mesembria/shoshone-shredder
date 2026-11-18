// Boulder Dash: off the summit down the steep face, straight. A rough rooty pitch with small rocks to pick through, a
// rock garden with one lane per row, then the long fast straight (a step-down partway, then three staggered boulders
// you have to swerve round) and a long run-out onto the flat. The profile and every rock's place along the trail are the
// old park's Rock chute (the old park built its chute from the same chuteProfile), so the ride is the same.
import { Profile, heightAt } from '../../lab/course';
import { TrailPath, type Trail, type TrailFeatures, type TrailZone } from '../trail';

export const CHUTE_WIDTH = 3.5;
export const CHUTE_TOP = 20; // the summit: Boulder Dash starts at the top of the hill
// On the fast straight a step-down at run u = stepU, then boulders at run u, staggered (dz) so you have to swerve: too
// fast and you can't turn tightly enough (Nov 7: a careless enduro used to 3-star it).
export const CHUTE_STEP_U = 58;
export const CHUTE_BOULDERS: [number, number, number][] = [[76, 0.85, 0.75], [82.5, -0.85, 0.75], [89, 0, 0.6]]; // [u, dz, r]

// Where things are along the chute's profile
export interface ChuteMarks {
  startU: number; aU: number; aEnd: number; bU: number; bEnd: number; lipU: number; lipH: number; knuckle: number;
  landEnd: number; cEnd: number; finishU: number;
}

// The old Rock chute's profile, step for step (the old park and the hill both build from it)
export function chuteProfile(top = CHUTE_TOP): { p: Profile; m: ChuteMarks } {
  const p = new Profile();
  p.pts[0] = [0, top];
  p.flat(5);
  const startU = 4;
  p.convex(0, -14, 8);
  const aU = p.u;
  p.slopeTo(-14, top - 6.5); // A: rough and rooty, small rocks to pick through
  const aEnd = p.u;
  p.concave(-14, -5, 10);
  const bU = p.u;
  p.slopeTo(-5, p.h - 1.6); // B: a rock garden, one lane per row
  const bEnd = p.u;
  // C: the long fast straight, rough and braided: it rattles every bike. Partway down, a step-down (level off, a small
  // lip, a steeper landing back onto the straight), then the boulders
  const t12 = Math.tan((12 * Math.PI) / 180);
  p.convex(-5, -12, 10);
  p.slopeTo(-12, p.h - t12 * (CHUTE_STEP_U - p.u));
  p.concave(-12, 0, 6).flat(1);
  const h0 = p.h;
  p.kick(h0 + 0.45, 20);
  const lipU = p.u, lipH = p.h;
  p.flat(1.2);
  const knuckle = p.u;
  p.slopeTo(-24, h0 - 1).concave(-24, -12, 6);
  const landEnd = p.u;
  p.slopeTo(-12, 1.6);
  const cEnd = p.u;
  if (CHUTE_BOULDERS[CHUTE_BOULDERS.length - 1][0] > cEnd - 2 || CHUTE_BOULDERS[0][0] < landEnd + 4) throw new Error('chute boulders off the straight');
  p.concave(-12, 0, 14).flat(50);
  const finishU = p.u - 25;
  return { p, m: { startU, aU, aEnd, bU, bEnd, lipU, lipH, knuckle, landEnd, cEnd, finishU } };
}

// The small rocks of A and the rock rows of B, as the old chute placed them: [u, dz, r]. B's rows sit a little skewed
// (u + 0.2 dz) like the old ones.
export function chuteRocks(m: ChuteMarks): [number, number, number][] {
  const out: [number, number, number][] = [];
  // A: small rocks (about 0.2-0.35 m tall) scattered, always leaving a way through
  for (let u = m.aU + 2, i = 0; u < m.aEnd - 1; u += 2.6, i++) {
    const side = i % 2 ? 1 : -1;
    out.push([u, side * 0.9, 0.17 + 0.04 * (i % 3)]);
    if (i % 3 === 1) out.push([u + 1.1, -side * 0.3, 0.2]);
  }
  // B: rows of rocks a bit taller (0.3-0.45 m), one lane through each, left, right, middle
  for (let u = m.bU + 2, i = 0; u < m.bEnd - 1; u += 3.4, i++) {
    const lane = [-1, 1, 0][i % 3] * 1.0;
    for (const dz of [-1.2, -0.4, 0.4, 1.2]) if (Math.abs(dz - lane) > 0.7) out.push([u + 0.2 * dz, dz, 0.24 + 0.05 * ((i + Math.round(dz * 5)) % 2)]);
  }
  return out;
}

// Past the old profile's end (its run-out flat, 1.3 m up) the trail rolls down onto the trailhead's level, so the bottom
// meets the lot instead of ending in a step. It is past the finish line, so the timed run never reaches it.
const ROLL = { deg: 5, R: 15 }, Y0 = 0.02;
const rollDown = (p: Profile) => p.convex(0, -ROLL.deg, ROLL.R).landing(ROLL.deg, ROLL.R);
// Boulder Dash runs due west (yaw 0 is +x) from the summit and ends at (END.x, END.z), on the trailhead lot's edge. Its
// long straight runs past Goat Ladder's first leg on its north side (z is south).
export const CHUTE_END = { x: 58, z: 58 };

export interface BoulderMarks extends ChuteMarks { boulders: [number, number] } // boulders: the u span they cover

export function boulderDash(): { trail: Trail; features: TrailFeatures; rough: TrailZone[]; marks: BoulderMarks } {
  const { p, m } = chuteProfile();
  const old = p.u;
  rollDown(p);
  const path = new TrailPath(CHUTE_END.x + p.u, CHUTE_END.z, Math.PI).straight(p.u);
  const trail: Trail = { id: 'boulderDash', path, profile: p, width: CHUTE_WIDTH, y0: Y0 };
  const features: TrailFeatures = { ledges: [], rocks: [], gravel: [], jumps: [], slabs: [], logs: [] };
  // the old chute ran toward +x, where +z is the rider's right, so dz is already off
  for (const [u, off, r] of [...chuteRocks(m), ...CHUTE_BOULDERS]) features.rocks.push({ trail, u, off, r });
  features.jumps.push({ trail, lipU: m.lipU, lipH: m.lipH, knuckle: m.knuckle - m.lipU, landLen: m.landEnd - m.knuckle, drop: m.lipH - heightAt(p, m.landEnd) });
  const half = CHUTE_WIDTH / 2;
  const rough: TrailZone[] = [{ trail, u0: m.aU, u1: m.cEnd + 8, off0: -half, off1: half }];
  if (Math.abs(heightAt(p, old) - heightAt(p, old - 1)) > 1e-9) throw new Error('chute run-out not flat at its old end');
  const b = CHUTE_BOULDERS;
  return { trail, features, rough, marks: { ...m, boulders: [b[0][0] - 1, b[b.length - 1][0] + 1] } };
}
