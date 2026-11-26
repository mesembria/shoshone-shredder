// The ladder check: robot riders on every challenge, on five loadouts (a, b, c, c+ and d, with a+ when a lock needs it), fed through the game's own challenge code (the
// same ticks main.ts sends, the downhill boost on Downhill runs). Prints each loadout's best result and whether the
// star targets hold the ladder:
//   (a) bare hardtail: 1★ (or the cheapest hardtail build that opens the lock), never 2★
//   (b) hardtail with all its parts: 2★, never 3★
//   (c) the matching bike stock, ridden carelessly: never 3★
//   (d) the matching bike with its parts (every mix tried), ridden well: 3★
// Matching bike: Bolinas for Trail, Enduro for Downhill, Dirt Jumper for Park.
// ONLY=goatUp,tableSmall picks challenges; GROUP=trail|downhill|park a group; LOAD=a,b picks loadouts;
// BOOST=3 BOOSTTIME=0.6 try another downhill boost; VERBOSE=1 prints every ride.
// LANDLOG=<dir> appends every ride, with each landing's impact and slope, to <dir>/<challenges>.jsonl, for tuning
// landing rules from one run (summarise it with checks/landing-log.ts).
// The hill's challenges (Goat Ladder, Hairpin Hollow, Boulder Dash) ride on Shredder Hills: the lines are planned along
// each curved trail (sideways offsets from its centreline). Each trail challenge also gets the edge rider (rows e·a, e·b,
// e·d): it rides beside the trail, off = ±(width/2 + 1.0), wherever a rock, ledge, gravel or log is within 3 m ahead,
// and the middle otherwise; it must never beat 2★. EDGE=0 leaves it out; EDGEOFF=2.2 tries it further out (metres past
// the edge).
// The park's challenges (Table Row, Whoop-de-Doo, the Pump House, Cone Zone, the Plank) ride on Mesa Jump Park. Each
// challenge is ridden in the place its spot is in.
import { appendFileSync, mkdirSync } from 'node:fs';
const P = new URL('../src', import.meta.url).pathname;
const THREE = await import('three');
const { buildPlace, placeOfStation } = await import(`${P}/world/places/index.ts`);
const park = await import(`${P}/world/places/park.ts`);
const { createLabState, placeBike, stepLab, crashBack } = await import(`${P}/lab/bike.ts`);
const { startTrack, routeTick } = await import(`${P}/game/stayOnTrail.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
const { loadout, applyLoadout, partsFor, stockFitted, SLOTS, PARTS } = await import(`${P}/game/catalog.ts`);
const { CHALLENGES, DOWNHILL_BOOST, startRun, tick, trickTick } = await import(`${P}/game/challenges.ts`);
const { runEvent, lapEvent, createPlankWatch, segmentsCross } = await import(`${P}/game/spots.ts`);
const { inZone, inZoneHeading, trailPoint, obstacleSpans } = await import(`${P}/world/trail.ts`);
const { bumpers } = await import(`${P}/lab/course.ts`);
const { pastEnd, blockedProbe, offsetsAcross, planLine } = await import('./follow.ts');
const { statsFor } = await import(`${P}/game/stats.ts`);
const { HAIRPIN: HP } = await import(`${P}/world/trails/hairpin.ts`);
// where the park's features are
const RHYTHM = park.RHYTHM, XL_LANE = park.XL_LANE, CONES = park.SLALOM, LANE = park.LANES;

const hillCourse = buildPlace('shredderHills'), parkCourse = buildPlace('mesaJumpPark');
const PLANKS = parkCourse.planks!, PUMP_TRACK = parkCourse.pumpTrack!;
const hillPhys = await createPhysics(hillCourse.world), parkPhys = await createPhysics(parkCourse.world);
// the place being ridden: the lines below are planned on the hill; ride() switches these to the challenge's place
let course = hillCourse, phys = hillPhys, C = course.climb;
// the plants that hold a trail's edge (the hill's clumps): solid, so the lines go round them as round rocks
const inClump = (x: number, z: number) => (course.bumpers.firm ? course.bumpers.spots : []).some((c: any) => Math.hypot(x - c.x, z - c.z) < c.r);
const DT = 1 / 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const inside = (a: any, x: number, z: number) => inZone(a, x, z);
type Pt = [number, number];

const straight = (x0: number, x1: number, z: number): Pt[] => {
  const o: Pt[] = [], n = Math.ceil(Math.abs(x1 - x0) / 0.25);
  for (let i = 0; i <= n; i++) o.push([x0 + Math.sign(x1 - x0) * i * 0.25, z]);
  return o;
};
const st0 = course.stations.Climb, SR = 3.5; // Goat Ladder's start and its switchbacks' radius

// ---- the lines along the hill's curved trails (u along, offsets to the right): dynamic programming over sideways
// offsets round anything blocked (as the older robots do)
const HT = course.trails, hUp = HT.goatUp, hDown = HT.goatDown, hHp = HT.hairpin, hBd = HT.boulderDash;
const GT = Math.PI * SR; // a Goat Ladder switchback's length
// the probe for rocks, stretched along the trail's heading instead of along x; the log counts as clear (it's hopped)
const logAlong = (L: any, x: number, z: number) => Math.abs((x - L.pos.x) * Math.cos(L.yaw) - (z - L.pos.z) * Math.sin(L.yaw));
const blockedAlongBy = (r1: number, skipLogs: boolean) => blockedProbe(phys, { r1, rMax: 0.55, n: 10, from: 40, depth: 60, rockOk: skipLogs ? (px, pz) => C.ledges.some((L: any) => L.log && logAlong(L, px, pz) < 1.5) : undefined, also: inClump });
const climbAlong = blockedAlongBy(1.3, false), downAlong = blockedAlongBy(1.6, true);
// a point u along trail t, off to the right; past its end it carries on straight (onto the flat)
const at = (t: any, u: number, off = 0): Pt => {
  if (u <= t.path.length) { const p = trailPoint(t, u, off); return [p.x, p.z]; }
  const e = pastEnd(t, u), y = t.path.at(t.path.length).yaw;
  return [e.x + off * Math.sin(y), e.z + off * Math.cos(y)];
};
// the line along t from u0 to u1
const planAlong = (t: any, u0: number, u1: number, blocked: (x: number, z: number, yaw: number) => boolean, loosePref = 0, spread = 1.2): Pt[] =>
  planLine(u0, u1, offsetsAcross(spread), (u, d) => {
    const [x, z] = at(t, u, d);
    return (blocked(x, z, t.path.at(u).yaw) ? 1e6 : 0) + 0.03 * Math.abs(d) + (C.loose.some((a: any) => inside(a, x, z)) ? loosePref : 0);
  }, (u, d) => at(t, u, d), { window: 2, startBias: 2, endBias: 2 });
// the centreline from u0 to u1 (backwards when u1 < u0), every 0.25 m: the switchbacks, ridden down the middle
const centre = (t: any, u0: number, u1: number): Pt[] => {
  const n = Math.ceil(Math.abs(u1 - u0) / 0.25), o: Pt[] = [];
  for (let i = 0; i <= n; i++) o.push(at(t, u0 + ((u1 - u0) * i) / n));
  return o;
};
const gm = (await import(`${P}/world/trails/goatLadder.ts`)).goatLadder().marks;
const hm = (await import(`${P}/world/trails/hairpin.ts`)).hairpin().marks;
const bm = (await import(`${P}/world/trails/boulderDash.ts`)).boulderDash().marks;
const hillGoatUp = (loosePref: number): Pt[] => {
  const [a, b] = gm.switchbacks, uSt = hUp.path.nearest(st0.pos.x, st0.pos.z).u;
  return [
    ...planAlong(hUp, uSt, a, climbAlong, loosePref), ...centre(hUp, a, a + GT),
    ...planAlong(hUp, a + GT, b, climbAlong, loosePref), ...centre(hUp, b, b + GT),
    ...planAlong(hUp, b + GT, hUp.path.length, climbAlong, loosePref),
  ];
};
const hillGoatDown = () => planAlong(hDown, GT + 1, GT + 95, downAlong);
const hillGoatBoth = (loosePref: number): Pt[] => [...hillGoatUp(loosePref), ...centre(hDown, 0, GT), ...hillGoatDown()];
// Hairpin Hollow: leg 1's start to leg 5's end down the middle; down is the same line backwards (on along the lead-in)
const hillHairpin = () => centre(hHp, hm.legs[0][0], hHp.path.length);
const hillHpUp = () => [...hillHairpin(), ...centre(hHp, hHp.path.length, hHp.path.length + 3)];
const hillHpDown = () => [...hillHairpin().reverse(), ...centre(hHp, hm.legs[0][0], hm.legs[0][0] - 4)];
// the top: past the end, a 2 m loop round the platform (which reaches out on the rider's left here) onto the way back
const hillHpTop = (): Pt[] => {
  const e = hHp.path.at(hHp.path.length), c = Math.cos(e.yaw), sn = Math.sin(e.yaw), turn: Pt[] = [];
  const local = (along: number, right: number): Pt => [e.x + along * c + right * sn, e.z - along * sn + right * c];
  for (let a = 0; a <= 2 * Math.PI; a += 0.25 / 2) turn.push(local(3 - 2 * Math.cos(a), -(1.5 + 2 * Math.sin(a) - 1.5 * Math.cos(a / 2) ** 2)));
  return [...centre(hHp, hHp.path.length, hHp.path.length + 1), ...turn];
};
const hillHpBoth = () => [...hillHairpin(), ...hillHpTop(), ...hillHairpin().reverse(), ...centre(hHp, hm.legs[0][0], hm.legs[0][0] - 4)];
const hillChute = () => planAlong(hBd, 1, 150, climbAlong, 0, 1.1);

// ---- the edge rider: beside the trail wherever something to ride round is within 3 m ahead, the middle otherwise
const EDGE = Number(process.env.EDGEOFF ?? 1);
const feats = await (async () => {
  const gf = (await import(`${P}/world/trails/goatLadder.ts`)).goatLadder().features, hf = (await import(`${P}/world/trails/hairpin.ts`)).hairpin().features;
  const bf = (await import(`${P}/world/trails/boulderDash.ts`)).boulderDash().features;
  const of: Record<string, any> = { goatUp: gf, goatDown: gf, hairpin: hf, boulderDash: bf };
  return (t: any) => obstacleSpans(of[t.id], t) as [number, number][];
})();
// the line along t from u0 to u1 (backwards when u1 < u0), every 0.25 m, on `side` of the trail near obstacles
const edgeAlong = (t: any, u0: number, u1: number, side: number): Pt[] => {
  const spans = feats(t), dir = Math.sign(u1 - u0), n = Math.ceil(Math.abs(u1 - u0) / 0.25), o: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n, near = spans.some(([a, b]) => (dir > 0 ? a <= u + 3 && b >= u : b >= u - 3 && a <= u));
    o.push(at(t, u, near ? side * (t.width / 2 + EDGE) : 0));
  }
  return o;
};
const edgeGoatUp = (side: number): Pt[] => {
  const [a, b] = gm.switchbacks, uSt = hUp.path.nearest(st0.pos.x, st0.pos.z).u;
  return [...edgeAlong(hUp, uSt, a, side), ...centre(hUp, a, a + GT), ...edgeAlong(hUp, a + GT, b, side), ...centre(hUp, b, b + GT), ...edgeAlong(hUp, b + GT, hUp.path.length, side)];
};
const edgeGoatDown = (side: number) => edgeAlong(hDown, GT + 1, GT + 95, side);
const edgeHp = (side: number, back = false) => (back ? edgeAlong(hHp, hHp.path.length, hm.legs[0][0], side) : edgeAlong(hHp, hm.legs[0][0], hHp.path.length, side));
const EDGE_PATHS: Record<string, (side: number) => Pt[]> = {
  goatUp: edgeGoatUp,
  goatDown: edgeGoatDown,
  goatBoth: (side) => [...edgeGoatUp(side), ...centre(hDown, 0, GT), ...edgeGoatDown(side)],
  hairpinUp: (side) => [...edgeHp(side), ...centre(hHp, hHp.path.length, hHp.path.length + 3)],
  hairpinDown: (side) => [...edgeHp(side, true), ...centre(hHp, hm.legs[0][0], hm.legs[0][0] - 4)],
  hairpinBoth: (side) => [...edgeHp(side), ...hillHpTop(), ...edgeHp(side, true), ...centre(hHp, hm.legs[0][0], hm.legs[0][0] - 4)],
  boulderDash: (side) => edgeAlong(hBd, 1, 150, side),
};

const goatUp = hillGoatUp, goatDown = hillGoatDown(), goatBoth = hillGoatBoth;
const hpUp = hillHpUp(), hpDown = hillHpDown(), hpBoth = hillHpBoth();
const chute = hillChute();
const pumpLoop = (() => {
  const { x, z, half, R } = PUMP_TRACK, o: Pt[] = [];
  for (let u = x - half; u < x + half; u += 0.25) o.push([u, z - R]);
  for (let a = 0; a < Math.PI; a += 0.25 / R) o.push([x + half + R * Math.sin(a), z - R * Math.cos(a)]);
  for (let u = x + half; u > x - half; u -= 0.25) o.push([u, z + R]);
  for (let a = 0; a < Math.PI; a += 0.25 / R) o.push([x - half - R * Math.sin(a), z + R * Math.cos(a)]);
  return o;
})();

// ---- styles: what the robot does with the stick and the buttons
interface Here { climb: boolean; loose: boolean; rough: boolean; coast: boolean }
interface Style {
  name: string; careless?: boolean;
  stick: (s: any, h: Here) => number; // -1 brake .. 1 sprint
  ledges?: 'hop' | 'bonk' | 'never'; // ledges and the log: hop them, hop only once stopped against one, or never
  pop?: boolean; popMax?: number; pump?: boolean; // pop takeoffs (hold up the ramp, let go at the lip); pump downslopes
  trick?: 'up' | 'down' | 'left' | 'table' | 'best' | null; chain?: number; reckless?: boolean; // best: the biggest that fits; reckless: no air to spare
  manual?: boolean; rest?: boolean; gain?: number; aim?: number;
  flatHops?: boolean; // tap Jump whenever it's on flat ground (a hop exploit probe)
  chainManual?: boolean; // jump lines: manual from each landing to the next takeoff ramp, so one combo runs down the line
  gapHop?: number; hopHold?: number; // the Plank: hop when the front wheel is this far (m) from the gap, holding the hop this long (s)
}
// speed caps: pedal up to n m/s and brake above it, or up to m under the bike's wobble speed
const cap = (n: number) => (s: any) => (s.speed > n ? -1 : 1);
const capW = (m: number) => (s: any) => (T.wobbleSpeed > 0 && s.speed > T.wobbleSpeed - m ? -1 : 1);
// slow for a sharp turn coming up: brake when the turn is closer than the stopping distance to a speed it can take
// (the plan's turn radius and the bike's grip; f > 1 brakes later and faster)
let PATH: Pt[] = [], IDX = 0, TURN_R = 2;
function turnAhead(s: any, f = 1): boolean {
  const vTurn = f * Math.sqrt(T.grip * TURN_R) * 0.75;
  if (s.speed <= vTurn) return false;
  const reach = (s.speed * s.speed - vTurn * vTurn) / (2 * Math.max(2, T.brake * 0.6)) + 1.5;
  const h0 = PATH[Math.min(PATH.length - 1, IDX + 2)], h1 = PATH[Math.min(PATH.length - 1, IDX + 6)];
  const yaw0 = Math.atan2(h1[1] - h0[1], h1[0] - h0[0]);
  for (let k = IDX + 6, d = 0; k < PATH.length - 4 && d < reach; k += 2, d += 0.5) {
    const a = PATH[k], b = PATH[k + 4];
    if (Math.abs(wrap(Math.atan2(b[1] - a[1], b[0] - a[0]) - yaw0)) > 1.2) return true;
  }
  return false;
}
// rocks beside the line ahead, closer than the distance it takes to brake to n: slow for them, let it run elsewhere
const ROCKY = new Map<Pt[], boolean[]>();
function rockyFlags(path: Pt[]): boolean[] {
  if (!ROCKY.has(path)) ROCKY.set(path, path.map(([x, z], i) => {
    const [nx, nz] = path[Math.min(path.length - 1, i + 1)], dx = nx - x, dz = nz - z, d = Math.hypot(dx, dz) || 1;
    return [-1.1, -0.6, 0, 0.6, 1.1].some((o) => castDown(phys, x - (dz / d) * o, 40, z + (dx / d) * o, 60)?.surface === 'rock');
  }));
  return ROCKY.get(path)!;
}
const rocksAhead = (s: any, n: number) => {
  const f = rockyFlags(PATH), reach = Math.max(0, (s.speed * s.speed - n * n) / (2 * Math.max(2, T.brake * 0.6))) + 2;
  for (let k = Math.max(0, IDX - 4); k < Math.min(f.length, IDX + reach / 0.25); k++) if (f[k]) return true;
  return false;
};
// pedal up to just under the wobble speed, braking to n for rocks
// Boulder Dash: at most n m/s from a little before the boulders to the last one, else up to just under the wobble speed
const nearBoulders = (s: any, lead: number) => { const n = hBd.path.nearest(s.pos.x, s.pos.z); return n.u > bm.boulders[0] - lead && n.u < bm.boulders[1] && Math.abs(n.off) < 3; };
const boulderCap = (n: number, lead = 6) => (s: any) => (nearBoulders(s, lead) ? (s.speed > n ? -1 : 1) : capW(0.3)(s));
const rockCap = (n: number, m = 0.3) => (s: any) => (rocksAhead(s, n) ? (s.speed > n ? -1 : 1) : capW(m)(s));
const CLIMB: Style[] = [
  { name: 'smart (gravel easy)', stick: (_s, h) => (h.loose ? 0.35 : 1), ledges: 'hop' },
  { name: 'smart, rests when tired', stick: (_s, h) => (h.loose ? 0.35 : 1), ledges: 'hop', rest: true },
  { name: 'steady (stick a quarter up)', stick: (_s, h) => (h.loose ? 0.35 : 0.25), ledges: 'hop' },
  { name: 'steady (stick half up)', stick: (_s, h) => (h.loose ? 0.35 : 0.5), ledges: 'hop' },
  { name: 'steady (stick three quarters up)', stick: (_s, h) => (h.loose ? 0.35 : 0.75), ledges: 'hop' },
  { name: 'smart, lets go on gravel', stick: (_s, h) => (h.loose ? 0 : 1), ledges: 'hop' },
  { name: 'hops only after a bonk', stick: (_s, h) => (h.loose ? 0.35 : 1), ledges: 'bonk' },
  { name: 'stick up the whole way', careless: true, stick: () => 1, ledges: 'hop' },
  { name: 'cruise everywhere', careless: true, stick: () => 0, ledges: 'bonk' },
];
const DESCENT: Style[] = [
  ...[6, 7, 8, 9, 10, 12, 14].map((n): Style => ({ name: `pedals to ${n} m/s, hops`, stick: cap(n), ledges: 'hop' })),
  ...[1, 0.5, 0.2].map((m): Style => ({ name: `pedals to ${m} under wobble, hops`, stick: capW(m), ledges: 'hop' })),
  ...[6, 7, 8, 9, 10].map((n): Style => ({ name: `brakes to ${n} for rocks, hops`, stick: rockCap(n), ledges: 'hop' })),
  ...[7, 8, 9].map((n): Style => ({ name: `brakes to ${n} for rocks, pops, tricks`, stick: rockCap(n), ledges: 'hop', pop: true, trick: 'best', chain: 3 })),
  ...[8, 10, 12].map((n): Style => ({ name: `pedals to ${n} m/s, pops, tricks`, stick: cap(n), ledges: 'hop', pop: true, trick: 'best', chain: 3 })),
  { name: 'pedals to its wobble, pops, tricks', stick: capW(0.3), ledges: 'hop', pop: true, trick: 'best', chain: 3 },
  { name: 'stick up the whole way, hops', careless: true, stick: () => 1, ledges: 'hop' },
  { name: 'cruise, hops the log', careless: true, stick: () => 0, ledges: 'hop' },
];
// at Goat Ladder's top (the last 3 m of the climb, the summit turn and the first 3 m of the descent) and not
// yet heading down the descent
const hillSummit = (s: any) => {
  const nu = hUp.path.nearest(s.pos.x, s.pos.z), nd = hDown.path.nearest(s.pos.x, s.pos.z);
  const top = (nu.u > hUp.path.length - 3 && nu.dist < 5) || (nd.u < GT + 3 && nd.dist < 5);
  return top && Math.cos(s.yaw - hDown.path.at(GT).yaw) < 0.85;
};
// up the climb with one style, round the summit (braking for it), down with another
const climbThenDown = (up: Style, down: Style, name: string, careless = false): Style => ({
  ...down, name, careless, rest: up.rest,
  stick: (s, h) => {
    if (h.climb) return up.stick(s, h);
    if (!careless && turnAhead(s)) return -1;
    // round the summit until heading back west: held under 4.5 m/s, as wide-turning bikes run off the edge faster
    const summit = hillSummit(s);
    if (summit) return !careless && s.speed > 4.5 ? -1 : Math.min(up.stick(s, h), careless ? 1 : 0.5);
    return down.stick(s, h);
  },
});
const BOTH: Style[] = [
  ...[6, 7, 8, 10, 12].map((n) => climbThenDown(CLIMB[0], { name: '', stick: cap(n), ledges: 'hop' }, `smart up, pedals to ${n} down`)),
  climbThenDown(CLIMB[0], { name: '', stick: capW(0.5), ledges: 'hop' }, 'smart up, pedals to its wobble down'),
  ...[6, 7, 8, 9].map((n) => climbThenDown(CLIMB[0], { name: '', stick: rockCap(n), ledges: 'hop' }, `smart up, brakes to ${n} for rocks down`)),
  ...[2, 3, 4].flatMap((c) => [6, 7].flatMap((n) => [
    climbThenDown(CLIMB[c], { name: '', stick: rockCap(n), ledges: 'hop' }, `${CLIMB[c].name.replace(/^steady \(stick (.*) up\)$/, '$1 stick')} up, brakes to ${n} for rocks down`),
    climbThenDown(CLIMB[c], { name: '', stick: cap(n), ledges: 'hop' }, `${CLIMB[c].name.replace(/^steady \(stick (.*) up\)$/, '$1 stick')} up, pedals to ${n} down`),
  ])),
  climbThenDown(CLIMB[0], { name: '', stick: rockCap(8), ledges: 'hop', pop: true, trick: 'best', chain: 3 }, 'smart up, brakes to 8 for rocks, tricks down'),
  climbThenDown(CLIMB[0], { name: '', stick: cap(10), ledges: 'hop', pop: true, trick: 'best', chain: 3 }, 'smart up, pedals to 10 down, tricks'),
  climbThenDown(CLIMB[4], { name: '', stick: cap(9), ledges: 'hop' }, 'three quarters up, pedals to 9 down'),
  climbThenDown(CLIMB[3], { name: '', stick: cap(10), ledges: 'hop' }, 'half stick up, pedals to 10 down'),
  climbThenDown(CLIMB[7], { name: '', stick: () => 1, ledges: 'hop' }, 'stick up all the way', true),
  climbThenDown(CLIMB[8], { name: '', stick: () => 0, ledges: 'hop' }, 'cruise all the way', true),
];
const HAIRPIN: Style[] = [
  { name: 'pushes, brakes for hairpins', stick: (s, h) => (turnAhead(s) ? -1 : h.loose ? 0.4 : 1) },
  { name: 'pushes, brakes late for hairpins', stick: (s, h) => (turnAhead(s, 1.25) ? -1 : h.loose ? 0.4 : 1) },
  { name: 'pushes, brakes early for hairpins', stick: (s, h) => (turnAhead(s, 0.8) ? -1 : h.loose ? 0.4 : 1) },
  { name: 'pushes, brakes for hairpins, pumps', stick: (s, h) => (turnAhead(s) ? -1 : h.loose ? 0.4 : 1), pump: true },
  { name: 'steady, brakes for hairpins, rests', stick: (s, h) => (turnAhead(s) ? -1 : h.loose ? 0.4 : 0), rest: true },
  { name: 'pushes on climbs, brakes for hairpins', stick: (s, h) => (turnAhead(s) ? -1 : h.loose ? 0.4 : h.climb ? 0.7 : 0) },
  { name: 'full stick', careless: true, stick: () => 1 },
  { name: 'cruise', careless: true, stick: () => 0 },
];
// Hairpin Hollow down: the same hairpin braking, plus popping the two step-downs and tricks (the downhill boost)
const HAIRPIN_DOWN: Style[] = [
  ...HAIRPIN,
  { name: 'pushes, brakes for hairpins, pops, tricks', stick: (s, h) => (turnAhead(s) ? -1 : h.loose ? 0.4 : 1), pop: true, trick: 'best', chain: 2 },
  { name: 'brakes late for hairpins, pops, tricks', stick: (s, h) => (turnAhead(s, 1.25) ? -1 : h.loose ? 0.4 : 1), pop: true, trick: 'best', chain: 2 },
  // a bike that keeps its speed off big landings (travel soaks them, Nov 19) reaches the hairpins faster: a good rider
  // brakes a touch later still. Without it the robot's one late-braking script lost the Enduro's 3★ by 0.4 s
  { name: 'brakes later for hairpins, pops, tricks', stick: (s, h) => (turnAhead(s, 1.35) ? -1 : h.loose ? 0.4 : 1), pop: true, trick: 'best', chain: 2 },
  { name: 'pedals to 8, brakes for hairpins, pops, tricks', stick: (s, h) => (turnAhead(s) ? -1 : s.speed > 8 ? -1 : 1), pop: true, trick: 'best', chain: 2 },
];
const CHUTE_STYLES: Style[] = [
  ...[8, 10, 12, 14].map((n): Style => ({ name: `pedals to ${n} m/s`, stick: cap(n) })),
  ...[1, 0.5, 0.2].map((m): Style => ({ name: `pedals to ${m} under wobble`, stick: capW(m) })),
  ...[6, 8, 10, 12].map((n): Style => ({ name: `brakes to ${n} for rocks`, stick: rockCap(n) })),
  { name: 'pedals to its wobble, pops, tricks', stick: capW(0.3), pop: true, trick: 'best', chain: 3 },
  ...[6, 8, 10, 12].map((n): Style => ({ name: `brakes to ${n} before the boulders, pops, tricks`, stick: boulderCap(n), pop: true, trick: 'best', chain: 3 })),
  { name: 'stick up, pops, tricks', stick: () => 1, pop: true, trick: 'best', chain: 3 },
  { name: 'stick up the whole way', careless: true, stick: () => 1 },
  { name: 'cruise', careless: true, stick: () => 0 },
];
const sprint = () => 1;
const TABLES: Style[] = [
  { name: 'taps Jump on every flat (hop chain guard)', stick: sprint, pop: true, trick: 'best', chain: 4, flatHops: true },
  { name: 'manual between, taps Jump on every flat (hop chain guard)', stick: sprint, pop: true, trick: 'best', chain: 4, chainManual: true, flatHops: true },
  { name: 'sprint, pop, as many tricks as fit', stick: sprint, pop: true, trick: 'best', chain: 4 },
  { name: 'sprint, pop, as many tricks as fit, manual between', stick: sprint, pop: true, trick: 'best', chain: 4, chainManual: true },
  { name: 'cruise, pop, as many tricks as fit', stick: () => 0, pop: true, trick: 'best', chain: 4 },
  { name: 'sprint, pop, backflip', stick: sprint, pop: true, trick: 'down' },
  { name: 'sprint, pop, two backflips', stick: sprint, pop: true, trick: 'down', chain: 2 },
  { name: 'sprint, pop, no-hander', stick: sprint, pop: true, trick: 'up' },
  { name: 'sprint, pop, two no-handers', stick: sprint, pop: true, trick: 'up', chain: 2 },
  { name: 'sprint, pop, tabletop', stick: sprint, pop: true, trick: 'table' },
  { name: 'cruise, pop, no-hander', stick: () => 0, pop: true, trick: 'up' },
  { name: 'sprint, pop, backflip anyway', stick: sprint, pop: true, trick: 'down', reckless: true },
  { name: 'sprint, pop, no trick', careless: true, stick: sprint, pop: true },
  { name: 'sprint, rolled, backflip', careless: true, stick: sprint, trick: 'down', reckless: true },
  { name: 'sprint, rolled, no-hander', careless: true, stick: sprint, trick: 'up', reckless: true },
  { name: 'cruise, rolled', careless: true, stick: () => 0 },
];
const WHOOP: Style[] = [
  { name: 'pops, pumps, as many tricks as fit', stick: () => 0, pop: true, pump: true, trick: 'best', chain: 4 },
  { name: 'pops, pumps, as many tricks as fit, manual between', stick: () => 0, pop: true, pump: true, trick: 'best', chain: 4, chainManual: true },
  { name: 'small pops, pumps, as many tricks as fit', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'best', chain: 4 },
  { name: 'small pops, pumps, as many tricks as fit, manual between', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'best', chain: 4, chainManual: true },
  { name: 'pops, pumps, no-handers', stick: () => 0, pop: true, pump: true, trick: 'up' },
  { name: 'small pops, pumps, no-handers', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'up' },
  { name: 'small pops, pumps, backflips', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'down' },
  { name: 'small pops, pumps, two backflips an air', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'down', chain: 2 },
  { name: 'pops, pumps, tabletops', stick: () => 0, pop: true, pump: true, trick: 'table' },
  { name: 'pops and pumps', careless: true, stick: () => 0, pop: true, pump: true },
  { name: 'rolls, no-handers', careless: true, stick: () => 0, trick: 'up', reckless: true },
  { name: 'rolls', careless: true, stick: () => 0 },
];
const PUMP: Style[] = [
  { name: 'pumps the backsides', stick: () => 0, pump: true, gain: 3 },
  { name: 'pumps, tight line', stick: () => 0, pump: true, gain: 4 },
  { name: 'pumps, loose line', stick: () => 0, pump: true, gain: 2 },
  { name: 'holds pump the whole way', careless: true, stick: () => 0, pump: true, gain: 3, popMax: -1 },
  { name: 'no pumping', careless: true, stick: () => 0, gain: 3 },
];
// Cone Zone: ride a planned weave (see weave) holding a speed cap, as a kid holds the stick part way; the careless rider
// holds the stick up and the steering has to keep up
const CONE: Style[] = [
  ...[5, 6, 7, 8, 9, 10, 11].flatMap((n) => [3, 5].map((g): Style => ({ name: `pedals to ${n} m/s, gain ${g}`, stick: cap(n), gain: g }))),
  { name: 'stick up the whole way', careless: true, stick: () => 1 },
  { name: 'cruise', careless: true, stick: () => 0 },
];
const PLANK: Style[] = [
  { name: 'taps Jump on every flat (hop chain guard)', stick: (s: any) => (s.speed > 4 ? -1 : 1), flatHops: true, manual: true },
  // manual to the gap, hop it, manual again (a manual re-swipes on landing): speed, how early the hop, how hard
  ...[-0.5, 0].flatMap((t) => [0.2, 0.5, 0.9].flatMap((d) => [0.05, 0.15].map((h): Style => ({ name: `${t < 0 ? 'slow' : 'cruise'}, manuals, hops the gap at ${d} m (${h} s)`, stick: () => t, manual: true, gapHop: d, hopHold: h })))),
  ...[3, 4, 5].flatMap((n) => [0.3, 0.7].map((d): Style => ({ name: `pedals to ${n} m/s, manuals, hops the gap at ${d} m`, stick: cap(n), manual: true, gapHop: d, hopHold: 0.15 }))),
  ...[0, 0.5].map((t): Style => ({ name: `${t ? 'pedals' : 'cruise'}, hops the gap, no manual`, stick: () => t, gapHop: 0.5, hopHold: 0.15 })),
  { name: 'cruise, no manual, no hop', careless: true, stick: () => 0 },
  { name: 'sprint, no manual, no hop', careless: true, stick: () => 1 },
];

// Cone Zone: from the start ring along the first gate's side, then a smooth weave through every gate, `cut` m inside its
// middle (the gate is 2.4 m wide, so up to about 1 m of cut still goes through)
const weave = (cut: number): Pt[] => {
  const amp = CONES.swing - cut, end = CONES.x0 + (CONES.count - 1) * CONES.step + 8, o: Pt[] = [];
  for (let x = parkCourse.stations.Slalom.pos.x; x <= end; x += 0.25) o.push([x, (CONES.z ?? 0) + (x < CONES.x0 ? amp : amp * Math.cos((Math.PI * (x - CONES.x0)) / CONES.step))]);
  return o;
};

// ---- each challenge: its line(s), styles, and how the robot steers
interface Plan { paths: Pt[][]; styles: Style[]; follow: 'line' | 'pump' | 'slalom'; turnR?: number }
const PLANS: Record<string, Plan> = {
  goatUp: { turnR: SR, paths: [goatUp(-0.05), goatUp(0.3)], styles: CLIMB, follow: 'line' },
  goatDown: { paths: [goatDown], styles: DESCENT, follow: 'line' },
  goatBoth: { turnR: SR, paths: [goatBoth(-0.05)], styles: BOTH, follow: 'line' },
  hairpinUp: { turnR: HP.SR, paths: [hpUp], styles: HAIRPIN, follow: 'line' },
  hairpinDown: { turnR: HP.SR, paths: [hpDown], styles: HAIRPIN_DOWN, follow: 'line' },
  hairpinBoth: { turnR: HP.SR, paths: [hpBoth], styles: HAIRPIN, follow: 'line' },
  boulderDash: { paths: [chute], styles: CHUTE_STYLES, follow: 'line' },
  tableSmall: { paths: [straight(-62, 64, LANE.S)], styles: TABLES, follow: 'line' },
  tableMedium: { paths: [straight(-62, 64, LANE.M)], styles: TABLES, follow: 'line' },
  tableBig: { paths: [straight(-62, 64, LANE.L)], styles: TABLES, follow: 'line' },
  tableXL: { paths: [straight(-62, 64, XL_LANE)], styles: TABLES, follow: 'line' },
  whoop: { paths: [straight(RHYTHM.x0, RHYTHM.x0 + 80, RHYTHM.z)], styles: WHOOP, follow: 'line' },
  pumpHouse: { paths: [pumpLoop], styles: PUMP, follow: 'pump' },
  coneZone: { paths: [weave(0.3), weave(0.7), weave(1)], styles: CONE, follow: 'line' },
  plank: { paths: [straight(-38, 2, PLANKS[0].z)], styles: PLANK, follow: 'line' }, // the narrow plank: the wide one is practice
};

// air left: follow the bike's flight forward until it meets the ground
function airLeft(s: any): number {
  let x = s.pos.x, y = s.pos.y, z = s.pos.z, vy = s.vy;
  const v = s.speed * (s.air?.pull ?? 1), vx = Math.cos(s.yaw) * v, vz = -Math.sin(s.yaw) * v;
  for (let t = 0; t < 3; t += 1 / 60) {
    const g = castDown(phys, x, y + 5, z, 30);
    if (g && y <= g.height) return t;
    x += vx / 60; z += vz / 60; y += vy / 60; vy -= (vy > T.floatBand ? T.gUp : vy > -T.floatBand ? T.gFloat : T.gDown) / 60; // as the bike falls
  }
  return 3;
}

// off: this run's bike left the dirt ribbon (its centre more than OFF_TOL m beyond a trail's edge, on the ground)
const OFF_TOL = 0.05;
interface Result { off?: boolean; leftBy?: number; ok: boolean; t: number; points: number; stars: number; why: string; style: string; fit: string; most?: number; cuts?: number }
// The most trick points that fit in one air of `air` seconds on a bike that spins `spin` (a skilled kid's hard limit):
// a pop, then backflips, 360s and no-handers back to back; the last one may land a little short of round, as a flip can.
const mostInAir = (air: number, spin: number) => 50 + mostIn((air - 0.05) * spin);
// the most points that fit in B seconds of trick time (air time x spin): no-handers must finish, a last move may be short
function mostIn(B: number): number {
  const flip = T.flipTime, turn = T.spinTime;
  let best = 0;
  for (let f = 0; f <= 4; f++) for (let r = 0; r <= 4; r++) for (let n = 0; n <= 6; n++) {
    const short = f ? 0.15 * flip : r ? 0.15 * turn : 0;
    if (f * flip + r * turn + n * 0.4 - short <= B) best = Math.max(best, 400 * f + 300 * r + 200 * n);
  }
  return best;
}
// the first trick of the best plan for B seconds of trick time left: a backflip, a 360 or a no-hander
function planTrick(B: number): 'down' | 'left' | 'up' | null {
  const opts: ['down' | 'left' | 'up', number, number][] = [['down', 400, T.flipTime], ['left', 300, T.spinTime], ['up', 200, 0.4]];
  let pick: 'down' | 'left' | 'up' | null = null, best = 0;
  for (const [k, pts, secs] of opts) {
    const v = B >= secs ? pts + mostIn(B - secs) : k !== 'up' && B >= 0.85 * secs ? pts : -1;
    if (v > best) { best = v; pick = k; }
  }
  return pick;
}
const LANDLOG = process.env.LANDLOG;
let landings: { impact: number; slope: number; outcome: string; airTime: number; fromLip: boolean }[] = [];
function ride(l: any, def: any, path: Pt[], sty: Style, fit: string): Result {
  landings = [];
  const r = rideOnce(l, def, path, sty, fit);
  if (LANDLOG) {
    mkdirSync(LANDLOG, { recursive: true });
    const rec = { challenge: def.id, bike: l.bike, fit, style: sty.name, kit: l.spec.kit ?? null, ok: r.ok, stars: r.stars, t: r.t, points: r.points, landings };
    appendFileSync(`${LANDLOG}/${process.env.ONLY ?? process.env.GROUP ?? 'all'}.jsonl`, JSON.stringify(rec) + '\n');
  }
  return r;
}
function rideOnce(l: any, def: any, path: Pt[], sty: Style, fit: string): Result {
  [course, phys] = placeOfStation(def.spot) === 'mesaJumpPark' ? [parkCourse, parkPhys] : [hillCourse, hillPhys];
  C = course.climb;
  Object.assign(T, DEFAULTS);
  applyLoadout(l);
  T.trickBoost = def.group === 'downhill' ? Number(process.env.BOOST ?? DOWNHILL_BOOST) : 0;
  if (process.env.BOOSTTIME) T.trickBoostTime = Number(process.env.BOOSTTIME);
  const st = course.stations[def.spot];
  const s = createLabState(l.spec, st.pos.clone(), st.yaw);
  placeBike(s, st.pos.clone(), st.yaw);
  if (st.speed) s.speed = st.speed;
  const run = startRun(def), plankWatch = createPlankWatch(PLANKS), g = def.goal;
  const plants = bumpers(course.bumpers.spots, { firm: course.bumpers.firm, ground: course.ground }); // a fresh set each ride: touches don't carry over
  const limit = (g.times ? g.times[0] : g.limit) + 1;
  PATH = path; IDX = 0; TURN_R = PLANS[def.id].turnR ?? 2;
  let airFromLip = false, wasCrash = false, held = 0, swiped = 0, resting = false, next = 0;
  let prev = { x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: true };
  let track: any = null, cuts = 0; // stay on the trail, as main.ts does it
  const hopped = new Set<number>(), airs: number[] = [];
  const ribbons: any[] = Object.values(course.trails ?? {});
  let leftBy = -Infinity; // the furthest the bike got beyond the nearest ribbon's edge, on the ground
  let gapHopped = false, chaining = false; // chaining: a lip landing happened, so keep the combo open with manuals
  for (let n = 0; n < limit / DT; n++) {
    const x = s.pos.x, z = s.pos.z;
    const here: Here = { coast: T.trackPedal < 0.5 && course.coast.some((a: any) => inside(a, x, z)), climb: C.area.some((a: any) => inZoneHeading(a, x, z, s.yaw)), loose: C.loose.some((a: any) => inside(a, x, z)), rough: course.rough.some((a: any) => inside(a, x, z)) };
    // steering: a point a little ahead on the line (further at speed), or the next slalom gate
    let tx: number, tz: number, gain = sty.gain ?? 3;
    if (PLANS[def.id].follow === 'slalom') {
      const gt = course.gates[Math.min(next, course.gates.length - 1)];
      tx = (gt.a.x + gt.b.x) / 2 + (sty.aim ?? 0.8); tz = (gt.a.y + gt.b.y) / 2;
    } else {
      const lo = def.goal.kind === 'lap' ? 0 : IDX, hi = def.goal.kind === 'lap' ? path.length : Math.min(path.length, IDX + 16);
      let best = IDX, bd = 1e9;
      for (let k = lo; k < hi; k++) { const d = (path[k][0] - x) ** 2 + (path[k][1] - z) ** 2; if (d < bd) { bd = d; best = k; } }
      IDX = best;
      const ahead = def.goal.kind === 'lap' ? 14 : Math.max(6, Math.round(s.speed * 1.2));
      [tx, tz] = path[(def.goal.kind === 'lap' ? best + ahead : Math.min(path.length - 1, best + ahead)) % path.length];
    }
    const steer = clamp(-wrap(Math.atan2(-(tz - z), tx - x) - s.yaw) * gain, -1, 1);
    let throttle = sty.stick(s, here);
    if (sty.rest) {
      if (!resting && s.energy < 0.3 && s.grounded && Math.abs(s.slope) < 0.04) resting = true;
      if (resting && s.energy >= 0.8) resting = false;
      if (resting) throttle = -1;
    }
    let hop: number | null = null, crouch = false, swipe: string | null = null;
    // ledges and the log: hop just before (closer when climbing slowly, further at speed), or once stopped against it
    C.ledges.forEach((L: any, k: number) => {
      // the distances measured in the ledge's own frame (along its riding direction, and beside it)
      const fx = Math.cos(L.yaw), fz = -Math.sin(L.yaw), dx = L.pos.x - s.pos.x, dz = L.pos.z - s.pos.z;
      const ahead = dx * fx + dz * fz - 0.55;
      const lined = Math.abs(dx * -fz + dz * fx) < L.half + 0.1 && Math.cos(s.yaw - L.yaw) > 0.5 && Math.abs(s.pos.y - L.pos.y) < 1.5;
      if (!lined || !s.grounded) return;
      if (sty.ledges === 'bonk' && s.dab > 0 && Math.abs(ahead) < 0.6) hop = 0.05;
      const win = L.log ? [0.6, 0.6 + 1.6 * Math.min(1, s.speed / 10)] : [0, 0.75];
      if (sty.ledges === 'hop' && !hopped.has(k) && ahead > win[0] && ahead < win[1]) { hop = 0.05; hopped.add(k); }
    });
    if (sty.pop && !here.climb) {
      if (s.grounded && s.slope > 0.15) { held += DT; crouch = true; } else if (held > 0) { hop = Math.min(held, sty.popMax ?? 9); held = 0; }
    }
    if (sty.pump && s.grounded && (sty.popMax === -1 || s.slope < -0.05)) crouch = true;
    // tricks: a swipe just after takeoff; careful styles only when there's air for it, chaining up to `chain` an air
    if (sty.trick && !s.grounded && s.air && s.air.t > 0.04 && swiped < (sty.chain ?? 1) && !s.move && !s.trick) {
      const pad = sty.trick === 'best' ? 0.05 : 0.1, left = airLeft(s), fits = (secs: number) => left > secs / s.bike.spin + pad;
      const pick = sty.trick !== 'best' ? sty.trick : planTrick((left - pad) * s.bike.spin);
      const secs = pick === 'down' ? 0.85 * T.flipTime : pick === 'left' ? 0.85 * T.spinTime : pick === 'table' ? 0.45 : 0.4;
      if (pick && (sty.reckless || fits(secs))) {
        if (pick === 'table') crouch = true; else swipe = pick;
        swiped++;
      }
    }
    if (sty.trick === 'table' && !s.grounded && s.crouchFor > 0) crouch = true;
    if (s.grounded) swiped = 0;
    if (sty.manual && s.grounded && s.manual <= 0 && s.pos.x > PLANKS[0].x0 - 3 && s.pos.x < PLANKS[0].x1) swipe = 'down';
    // chaining: a manual whenever none is going, on the ground after a lip landing, but not on a takeoff ramp (the pop)
    if (sty.flatHops && s.grounded && Math.abs(s.slope) < 0.05 && !hop) hop = 0.05;
    if (sty.chainManual && chaining && s.grounded && s.manual <= 0 && s.slope <= 0.15 && !swipe) swipe = 'down';
    const gap = PLANKS[0].gap;
    if (sty.gapHop !== undefined && gap && !gapHopped && s.grounded && Math.abs(s.pos.z - PLANKS[0].z) < 1 && gap[0] - s.pos.x - 0.55 < sty.gapHop) {
      hop = sty.hopHold ?? 0.15;
      swipe = null; // the hop, not a new manual
      gapHopped = true;
    }
    const ev = stepLab(s, { steer, throttle, hop, swipe, again: false, crouch, ...here }, DT, phys, course.lines);
    if (LANDLOG && ev.landed) landings.push({ impact: ev.impact ?? 0, slope: ev.slope ?? 0, outcome: ev.landed, airTime: ev.airTime ?? 0, fromLip: airFromLip });
    if (plants.update(DT, s.pos) && !s.crash) s.speed *= 0.92; // a plant bumped (the old park's bushes, the hill's clumps), as ride.ts does
    // what main.ts sends the challenge each step
    if (!s.grounded && s.air) airFromLip = s.air.line !== null;
    const crashStart = !!s.crash && !wasCrash;
    wasCrash = !!s.crash;
    const cur = { x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: s.grounded };
    const k: any = { dt: DT, ...trickTick(ev.banked, s.combo), landed: ev.landed ?? (crashStart ? 'wipeout' : undefined), airTime: ev.airTime };
    if (ev.landed) k.fromLip = airFromLip;
    if (ev.landed && airFromLip) chaining = true;
    if ((ev.landed === 'clean' || ev.landed === 'bobble') && airFromLip && (ev.airTime ?? 0) >= 0.35) airs.push(ev.airTime);
    if (process.env.TRACEAT && n % 6 === 0) { const [x0, x1, z0, z1] = process.env.TRACEAT.split(',').map(Number); if (s.pos.x > x0 && s.pos.x < x1 && s.pos.z > z0 && s.pos.z < z1) console.log(`      t ${run.t.toFixed(2)} x ${s.pos.x.toFixed(2)} z ${s.pos.z.toFixed(2)} y ${s.pos.y.toFixed(2)} v ${s.speed.toFixed(2)} yaw ${s.yaw.toFixed(2)} steer ${steer.toFixed(2)} thr ${throttle.toFixed(2)} wob ${s.wobble.toFixed(2)} ${s.crash ? 'CRASH' : ''} ${ev.wallStop ? 'wall' : ''} ${ev.hitRock ? 'rock' : ''}`); }
    if (process.env.TRACE && (ev.move || ev.trick || ev.landed || swipe)) console.log(`      t ${run.t.toFixed(2)} x ${s.pos.x.toFixed(1)} ${swipe ? 'swipe ' + swipe : ''} ${ev.move ?? ''} ${ev.trick ?? ''} ${ev.landed ? `landed ${ev.landed} air ${ev.airTime?.toFixed(2)}` : ''} left ${s.air ? airLeft(s).toFixed(2) : '-'}`);
    if (g.kind === 'lap') k.lap = lapEvent(prev, cur, PUMP_TRACK) ?? undefined;
    if (g.kind === 'plank') k.plank = plankWatch(cur) ?? undefined;
    if (g.kind === 'run') {
      const e = runEvent(def.id, prev, cur, course.runs);
      if (!track) {
        if (e === 'start') {
          track = startTrack(course.runs[def.id].route);
          k.run = 'start';
        }
      } else {
        const c = routeTick(track, s, prev, e === 'finish');
        if (c.finish) k.run = 'finish';
        if (c.top) k.top = true;
        if (c.cut) {
          crashBack(s, c.at);
          cuts++;
        }
      }
    }
    k.left = !inZone(course.zones[def.spot], cur.x, cur.z);
    if (ribbons.length && s.grounded) leftBy = Math.max(leftBy, Math.min(...ribbons.map((t: any) => t.path.probe(cur.x, cur.z).dist - t.width / 2)));
    let res = tick(run, k);
    if (g.kind === 'gates') course.gates.forEach((gt: any, i: number) => {
      if (res.state === 'running' && segmentsCross(new THREE.Vector2(prev.x, prev.z), new THREE.Vector2(cur.x, cur.z), gt.a, gt.b)) { res = tick(run, { dt: 0, gate: i }); if (i === next) next++; }
    });
    prev = cur;
    // a park run that cleared everything short of the 1-star points still counts as a ride, for its points
    if (res.state !== 'running') return { off: leftBy > OFF_TOL, leftBy, ok: res.state === 'done' || res.why === 'Not enough tricks!', t: run.t, points: run.points, stars: res.state === 'done' ? res.stars : 0, why: res.state === 'done' ? '' : `${res.why} @${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)}`, style: sty.name, fit, cuts, most: g.kind === 'jumps' && airs.length >= g.count ? airs.slice(0, g.count).reduce((n, a) => n + mostInAir(a, s.bike.spin), 0) : undefined };
  }
  return { off: leftBy > OFF_TOL, leftBy, ok: false, t: run.t, points: run.points, stars: 0, why: `no result @${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)}`, style: sty.name, fit, cuts };
}

// ---- loadouts
const MATCH: Record<string, string> = { trail: 'bolinas', downhill: 'enduro', park: 'dirtjumper' };
const upgrades = (b: string) => PARTS.filter((p: any) => p.bike === b && !p.stock);
// every slot upgraded (a slot with two upgrades, such as the hardtail's tires, gives two builds)
const allParts = (b: string) => mixes(b).filter((f) => SLOTS.every((slot: string) => !partsFor(b, slot).some((p: any) => !p.stock) || f[slot]));
// every mix of a bike's parts: each slot stock or one of its upgrades
function mixes(b: string): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const slot of SLOTS) {
    const ups = partsFor(b, slot).filter((p: any) => !p.stock);
    out = out.flatMap((f) => [f, ...ups.map((p: any) => ({ ...f, [slot]: p.id }))]);
  }
  return out;
}
const short = (f: Record<string, string>) => Object.values(f).map((id) => id.split('-').slice(1).join('-')).join('+') || 'stock';
const statOk = (def: any, l: any) => {
  const n = def.need ?? {};
  if (n.bike && !n.bike.includes(l.bike)) return false;
  return !n.stat || statsFor(l)[n.stat[0]] >= n.stat[1];
};
// the cheapest hardtail build that opens the challenge's lock (fewest parts, then lowest price)
function lockBuild(def: any): Record<string, string> | null {
  const ups = upgrades('hardtail');
  const subsets: any[][] = [];
  for (let m = 0; m < 1 << ups.length; m++) subsets.push(ups.filter((_: any, i: number) => m & (1 << i)));
  subsets.sort((a, b) => a.length - b.length || a.reduce((n: number, p: any) => n + p.price, 0) - b.reduce((n: number, p: any) => n + p.price, 0));
  const hit = subsets.find((ps) => statOk(def, loadout('hardtail', Object.fromEntries(ps.map((p: any) => [p.slot, p.id])))));
  return hit ? Object.fromEntries(hit.map((p: any) => [p.slot, p.id])) : null;
}

const better = (def: any, a: Result | null, b: Result) => {
  if (!b.ok) return a;
  if (!a) return b;
  const pts = def.goal.kind === 'jumps' || def.goal.kind === 'plank';
  return (pts ? b.points > a.points : b.t < a.t) ? b : a;
};
let cutRuns = 0; // runs with a cut, this challenge
function bestOf(def: any, bike: string, fits: Record<string, string>[], styles: Style[], paths: Pt[][] = PLANS[def.id].paths): { best: Result | null; runs: number; fails: number; most: number } {
  let best: Result | null = null, runs = 0, fails = 0, most = 0;
  for (const f of fits) {
    const l = loadout(bike, { ...stockFitted(bike), ...f });
    if (!statOk(def, l)) continue;
    for (const path of paths) for (const sty of styles) {
      const r = ride(l, def, path, sty, short(f));
      runs++;
      if (!r.ok) fails++;
      // a trail or edge rider should never cut the trail: say so on every run that did
      if (r.cuts) {
        cutRuns++;
        console.log(`    CUT ${bike} ${short(f)} ${sty.name}: cuts ${r.cuts} (${r.ok ? `${r.t.toFixed(2)} s ${r.stars}★` : r.why})`);
      }
      if (process.env.VERBOSE) console.log(`    ${bike.padEnd(10)} ${short(f).padEnd(28)} ${sty.name.padEnd(40)} ${r.ok ? `${r.t.toFixed(2)} s ${Math.round(r.points)} pts ${r.stars}★${r.leftBy !== undefined && r.leftBy > -Infinity ? ` (${r.leftBy > OFF_TOL ? 'off ribbon by' : 'on ribbon, edge within'} ${Math.abs(r.leftBy).toFixed(2)} m)` : ''}` : r.why}`);
      best = better(def, best, r);
      most = Math.max(most, r.most ?? 0);
    }
  }
  return { best, runs, fails, most };
}

const only = process.env.ONLY?.split(','), group = process.env.GROUP, load = (process.env.LOAD ?? 'a,b,c,d').split(',');
const fmtR = (def: any, r: Result | null) => {
  if (!r) return 'no finish'.padEnd(16);
  const pts = def.goal.kind === 'jumps' || def.goal.kind === 'plank';
  return `${pts ? `${Math.round(r.points)} pts` : `${r.t.toFixed(2)} s`} ${r.stars}★`.padEnd(16);
};
const score = (def: any, r: Result | null) => (!r ? null : def.goal.kind === 'jumps' || def.goal.kind === 'plank' ? r.points : r.t);
const holds: string[] = [], breaks: string[] = [], edgeBreaks: string[] = [];
const t0 = Date.now();
for (const def of CHALLENGES) {
  if (only && !only.includes(def.id)) continue;
  if (group && def.group !== group) continue;
  const plan = PLANS[def.id], m = MATCH[def.group], g = def.goal;
  cutRuns = 0;
  const careful = plan.styles, careless = plan.styles.filter((x) => x.careless);
  const lock = statOk(def, loadout('hardtail', {})) ? null : lockBuild(def);
  const rows: [string, string, { best: Result | null; runs: number; fails: number; most: number } | null][] = [];
  if (load.includes('a')) rows.push(['a', 'bare hardtail', statOk(def, loadout('hardtail', {})) ? bestOf(def, 'hardtail', [{}], careful) : null]);
  if (load.includes('a') && lock) rows.push(['a+', `hardtail ${short(lock)} (opens the lock)`, bestOf(def, 'hardtail', [lock], careful)]);
  const full = allParts('hardtail').filter((f) => statOk(def, loadout('hardtail', f)));
  if (load.includes('b')) rows.push(['b', 'hardtail, all parts', full.length ? bestOf(def, 'hardtail', full, careful) : null]);
  if (load.includes('c')) rows.push(['c', `${m} stock, careless`, bestOf(def, m, [{}], careless)]);
  if (load.includes('c')) rows.push(['c+', `${m} stock, ridden well`, bestOf(def, m, [{}], careful)]);
  if (load.includes('d')) rows.push(['d', `${m} with parts, ridden well`, bestOf(def, m, mixes(m), careful)]);
  // the edge rider, both sides, with every careful style: on the bare hardtail (or its lock build), with all its parts,
  // and on the matching bike with its parts
  const edge = process.env.EDGE !== '0' && EDGE_PATHS[def.id] ? [EDGE_PATHS[def.id](-1), EDGE_PATHS[def.id](1)] : null;
  const edgeStyles = careful.filter((x) => !x.careless);
  if (edge) {
    if (load.includes('a')) rows.push(['e·a', `edge: ${lock ? `hardtail ${short(lock)}` : 'bare hardtail'}`, bestOf(def, 'hardtail', [lock ?? {}], edgeStyles, edge)]);
    if (load.includes('b')) rows.push(['e·b', 'edge: hardtail, all parts', full.length ? bestOf(def, 'hardtail', full, edgeStyles, edge) : null]);
    if (load.includes('d')) rows.push(['e·d', `edge: ${m} with parts`, bestOf(def, m, mixes(m), edgeStyles, edge)]);
  }
  // FIT=hardtail:fast-tires,1x11 (or FIT=bolinas:stock) adds one more row for a build of your choice
  for (const spec of (process.env.FIT ?? '').split(';').filter(Boolean)) {
    const [bike, list] = spec.split(':'), f = Object.fromEntries((list === 'stock' ? [] : list.split(',')).map((n) => PARTS.find((p: any) => p.id === `${bike}-${n}`)).map((p: any) => [p.slot, p.id]));
    rows.push(['x', `${bike} ${short(f)}`, bestOf(def, bike, [f], careful)]);
  }
  const tiers = g.times ? `times ${g.times.join(' / ')}` : `points ${g.points.join(' / ')} (limit ${g.limit} s)`;
  console.log(`\n== ${def.name} (${def.id}, ${def.group}${def.need?.stat ? `, needs ${def.need.stat.join(' ')}` : ''})  ${tiers}`);
  for (const [k, name, r] of rows) console.log(`  ${k.padEnd(3)} ${name.padEnd(36)} ${r ? `${fmtR(def, r.best)} ${r.best ? `${r.best.style}${r.best.fit !== 'stock' ? ` [${r.best.fit}]` : ''}` : ''}  (${r.runs - r.fails}/${r.runs} finished)${r.most ? `  most that fits its airs ${r.most} pts` : ''}` : "can't start"}`);
  // the four-way rule under the current targets
  const get = (k: string) => rows.find((r) => r[0] === k)?.[2]?.best ?? null;
  const a = get('a+') ?? get('a'), b = get('b'), c = get('c'), d = get('d');
  const st = (r: Result | null) => r?.stars ?? 0;
  const rule: string[] = [];
  if (load.join() === 'a,b,c,d') {
    if (!a) rule.push(rows.find((r) => r[0] === 'a')?.[2] === null && !lock ? '1★ needs a bike the hardtail can\'t be (ruling)' : '1★ not reachable by (a)');
    else if (st(a) > 1 && !get('a+')) rule.push(`(a) reaches ${st(a)}★`);
    else if (st(a) < 1) rule.push('1★ not reachable by (a): it finished with 0★');
    // the lock build opens the lock, so what it scores is a design question (see the issue on lock builds), but it is no
    // longer hidden: say it, without breaking the rule
    if (get('a+') && st(get('a+')) > 1) console.log(`  note: the lock build reaches ${st(get('a+'))}★ (open question: does a lock build get to 2★?)`);
    if (full.length && !b) rule.push('(b) never finished');
    else if (b && st(b) < 2) rule.push('2★ not reachable by (b)');
    if (st(b) >= 3) rule.push('(b) reaches 3★');
    if (st(c) >= 3) rule.push('(c) reaches 3★');
    if (st(d) < 3) rule.push('3★ not reachable by (d)');
    (rule.length ? breaks : holds).push(def.id);
    console.log(`  rule: ${rule.length ? 'BREAKS: ' + rule.join('; ') : 'holds'}`);
    if (edge) {
      // an edge rider at 2★ or better: it breaks the rule only if its best run left the ribbon; on the ribbon it is accepted
      const fast = rows.filter((r) => r[0].startsWith('e·') && st(r[2]?.best ?? null) >= 2);
      const offTrail = fast.filter((r) => r[2]!.best!.off).map((r) => r[0]), onTrail = fast.filter((r) => !r[2]!.best!.off).map((r) => r[0]);
      console.log(`  edge: ${offTrail.length ? `BREAKS: ${offTrail.join(', ')} reach 2★ off the trail` : 'never 2★ off the trail'}`);
      if (onTrail.length) console.log(`  edge: on trail (accepted): ${onTrail.join(', ')} reach 2★`);
      if (offTrail.length) edgeBreaks.push(def.id);
    }
    const pts = !g.times, sc = (k: string) => score(def, get(k));
    console.log(`  scores: a ${sc('a+') ?? sc('a')}  b ${sc('b')}  c ${sc('c')}  c+ ${sc('c+')}  d ${sc('d')}  (${pts ? 'points, more is better' : 'seconds, less is better'})`);
    if (g.kind === 'run') console.log(`  cuts: ${cutRuns} runs cut the trail`);
  }
}
if (holds.length + breaks.length) console.log(`\nfour-way rule holds on ${holds.length}: ${holds.join(' ')}\nbreaks on ${breaks.length}: ${breaks.join(' ')}`);
if (process.env.EDGE !== '0' && holds.length + breaks.length) console.log(`edge rider reaches 2★ off the trail on ${edgeBreaks.length}: ${edgeBreaks.join(' ')}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
