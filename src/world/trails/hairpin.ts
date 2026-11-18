// Hairpin Hollow: five legs zigzagging up a steeper face, joined by four tight switchbacks (half circles of radius 2 round
// a boulder you can't cut across). Up and down are the same trail; the down run rides it in reverse. The legs' profiles
// and features are the old park's Switchbacks (the old park built its trail from the same hairpinLegs), so
// the ride is the same. On the hill the legs fan out from each switchback instead of running side by side: each one
// swings a little toward the next at its end (a gentle bend of 2·TILT), so the hillside between legs isn't a wall.
import { Profile } from '../../lab/course';
import { TrailPath, type Trail, type TrailFeatures } from '../trail';

export const HAIRPIN = { width: 2.5, SR: 2, leg: 46, rise: 2 }; // leg: each leg's length; rise: m each leg climbs, ridden up

// A step-down table for riders coming DOWN the trail, built into a leg that's ridden up (see hairpinLegs)
export interface StepDown { lipU: number; lipH: number; knuckle: number; landLen: number; drop: number; rise: number }

// The old Switchbacks' five leg profiles, step for step, each from its own start (u 0) to `leg` long; g0 to g1 is leg
// 1's gravel pitch; j2 and j4 the step-downs on legs 2 and 4.
export function hairpinLegs(): { legs: Profile[]; g0: number; g1: number; j2: StepDown; j4: StepDown } {
  const len = HAIRPIN.leg;
  const mk = (h0: number) => {
    const p = new Profile();
    p.pts[0] = [0, h0];
    return p;
  };
  const up = (p: Profile, deg: number, rise: number) => p.concave(0, deg, 5).slopeTo(deg, p.h + rise).convex(deg, 0, 5);
  const end = (p: Profile) => p.flat(Math.max(0, len - p.u));
  // In the down direction a small kick, a short top, then a landing onto lower ground; ridden up it's a short climb up
  // the landing (under 20°) and a little dip off the kick. Returns where the lip is along the leg (u), for its lip bar
  // and line.
  const stepDown = (p: Profile, H = 0.35, lip = 22, top = 1.5, landDeg = 20, drop = 0.6): StepDown => {
    const t = new Profile(); // the down direction, from its own start at height 0
    t.flat(1).kick(H, lip);
    const lipT = t.u, lipH = t.h;
    t.flat(top);
    const knuckleT = t.u;
    t.slopeTo(-landDeg, -drop).concave(-landDeg, 0, 4);
    const landT = t.u;
    t.flat(1);
    // ridden up we arrive at the low end, the landing's foot (t.h: the landing's round bottom takes it a little
    // below -drop), and climb `rise` to the kick's base
    const len = t.u, rise = -t.h, base = p.h + rise, u0 = p.u;
    for (let i = t.pts.length - 2; i >= 0; i--) p.pts.push([u0 + len - t.pts[i][0], base + t.pts[i][1]]);
    return { lipU: u0 + len - lipT, lipH: base + lipH, knuckle: knuckleT - lipT, landLen: landT - knuckleT, drop: lipH - t.h, rise };
  };
  // Each leg climbs HAIRPIN.rise ridden up (Nov 7: the trail climbs a hillside, so down is a real descent)
  // leg 1: two punchy pitches, the second one gravel
  const L1 = mk(0).flat(4);
  up(L1, 9, 1).flat(5);
  const g0 = L1.u;
  up(L1, 7, 1);
  const g1 = L1.u;
  end(L1.flat(3));
  // leg 2: a step-down for the way down, then a pitch
  const L2 = mk(L1.h).flat(6);
  const j2 = stepDown(L2);
  L2.flat(4);
  up(L2, 8, HAIRPIN.rise - j2.rise);
  end(L2);
  // leg 3: the big punchy climb
  const L3 = mk(L2.h).flat(3);
  up(L3, 10, 1.2).flat(4);
  up(L3, 6, 0.8);
  end(L3);
  // leg 4: a roller, a step-down for the way down, then a pitch
  const L4 = mk(L3.h).flat(3).wave(4, 0.45).flat(4);
  const j4 = stepDown(L4);
  L4.flat(4);
  up(L4, 7, HAIRPIN.rise - j4.rise);
  end(L4);
  // leg 5: up to the finish
  const L5 = mk(L4.h).flat(3);
  up(L5, 6, 1).flat(4);
  up(L5, 5, 1);
  end(L5);
  return { legs: [L1, L2, L3, L4, L5], g0, g1, j2, j4 };
}

// Where Hairpin Hollow starts (on the trailhead lot) and which way it sets off (yaw 0 is +x), set by the hill it sits on.
// A flat lead-in carries the trail off the lot and bends it onto leg 1, so the switchbacks at the bottom of the face sit
// clear of Goat Ladder's descent. TILT: how far each leg leans off straight across the face, so the legs fan out from the
// switchbacks.
export const HAIRPIN_START = { x: 26, z: 99, yaw: -Math.PI / 2 };
export const TILT = 12; // degrees
const LEAD = 6, BEND_R = 30, Y0 = 0.02; // the old dirt sat 2 cm above the ground; so does this ribbon

// Where things are along the trail: each leg's [start, end] u (a leg ends where its switchback starts; leg 1 starts after
// the lead-in), the four switchbacks' start u, the up run's bottom and top lines, the old stations' u, and the gravel.
export interface HairpinMarks {
  legs: [number, number][]; switchbacks: number[]; bottom: number; top: number; station: number; topStation: number;
  gravel: [number, number];
}

export function hairpin(): { trail: Trail; features: TrailFeatures; marks: HairpinMarks } {
  const { legs, g0, g1, j2, j4 } = hairpinLegs(), { width: TW, SR, leg } = HAIRPIN;
  const turn = Math.PI * SR, bend = (BEND_R * 2 * TILT * Math.PI) / 180;
  // Leg 1 leans TILT to the left of straight off the trailhead, toward the hill. The switchbacks alternate hands, left
  // first (the old pads' mirror image: the hill rises to the left of the trailhead), and before each one the leg swings
  // 2·TILT the other way, so the next leg leans TILT the same way across the face and the zigzag climbs toward the hill.
  const s = HAIRPIN_START, path = new TrailPath(s.x, s.z, s.yaw).straight(LEAD).arc(BEND_R, TILT);
  const lead = path.length, prof = new Profile();
  prof.pts[0] = [0, legs[0].pts[0][1]];
  prof.flat(lead);
  const marks: HairpinMarks = { legs: [], switchbacks: [], bottom: lead + 2, top: 0, station: lead + 0.5, topStation: 0, gravel: [lead + g0, lead + g1] };
  let u = lead;
  legs.forEach((p, i) => {
    for (const [pu, h] of p.pts.slice(1)) prof.pts.push([u + pu, h]);
    marks.legs.push([u, u + leg]);
    if (i === legs.length - 1) { path.straight(leg); return; }
    const side = i % 2 ? -1 : 1; // +1: the switchback turns left
    path.straight(leg - bend).arc(BEND_R, -side * 2 * TILT).arc(SR, side * 180);
    marks.switchbacks.push(u + leg);
    prof.flat(turn); // flat round the turn, at the leg's top height, like the old pads
    u += leg + turn;
  });
  const l5 = marks.legs[4][0];
  marks.top = l5 + leg - 3;
  marks.topStation = l5 + leg - 1;
  const trail: Trail = { id: 'hairpin', path, profile: prof, width: TW, y0: Y0 };
  const features: TrailFeatures = { ledges: [], rocks: [], gravel: [], jumps: [], slabs: [], logs: [] };
  features.gravel.push({ trail, u0: lead + g0, u1: lead + g1, off0: -TW / 2 - 0.3, off1: TW / 2 + 0.3 });
  // the two step-downs face down the trail: ridden in reverse
  for (const [i, j] of [[1, j2], [3, j4]] as const) {
    features.jumps.push({ trail, lipU: marks.legs[i][0] + j.lipU, lipH: j.lipH, knuckle: j.knuckle, landLen: j.landLen, drop: j.drop, reverse: true });
  }
  return { trail, features, marks };
}
