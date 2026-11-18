// Robot riders on the four showcase places, on every bike, a careful style and a reckless one each. Prints, per ride:
// the challenge result, time, crashes (and how many were speed wobbles), burnouts, feet down, tricks landed.
// BIKES=hardtail,enduro picks bikes (PARTS=all fits their upgrades); ONLY=chute (or rhythm, switchbacks, xl, flips) picks a place.
// Boulder Dash and Hairpin Hollow ride on Shredder Hills, planned and steered along the curved trails; Whoop-de-Doo
// (rhythm), Jumps XL (xl) and the big and medium flips ride on Mesa Jump Park.
const P = new URL('../src', import.meta.url).pathname;
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const { LAB_BIKES, applyBike } = await import(`${P}/lab/bikes.ts`);
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
const { CHALLENGES, DOWNHILL_BOOST, startRun, tick, trickTick } = await import(`${P}/game/challenges.ts`);
const { runEvent } = await import(`${P}/game/spots.ts`);
const { inZone, inZoneHeading, trailPoint } = await import(`${P}/world/trail.ts`);
const { buildPlace, placeOfStation } = await import(`${P}/world/places/index.ts`);
const { HAIRPIN } = await import(`${P}/world/trails/hairpin.ts`);
const park = await import(`${P}/world/places/park.ts`);
// where the rhythm line and the jump lanes are, on the jump park
const RHYTHM = park.RHYTHM, XL_LANE = park.XL_LANE, LANE = park.LANES;
const { loadout, applyLoadout, PARTS: CATALOG } = await import(`${P}/game/catalog.ts`);
// PARTS=stock (the default), all (every upgrade; the first where a slot has two) or a list of part ids
const loadoutFor = (b: string) => {
  const want = process.env.PARTS ?? 'stock', ups = CATALOG.filter((x: any) => x.bike === b && !x.stock);
  const pick = want === 'stock' ? [] : want === 'all' ? ups.filter((x: any, i: number) => ups.findIndex((y: any) => y.slot === x.slot) === i) : ups.filter((x: any) => want.split(',').includes(x.id));
  return loadout(b, Object.fromEntries(pick.map((x: any) => [x.slot, x.id])));
};


const BIKES = (process.env.BIKES ?? 'hardtail,dirtjumper,bolinas,enduro').split(',');
const ONLY = process.env.ONLY;
// both places, built once; `course` and `phys` are the one being ridden (ride() switches them to the challenge's place)
const hillCourse = buildPlace('shredderHills'), parkCourse = buildPlace('mesaJumpPark');
const hillPhys = await createPhysics(hillCourse.world), parkPhys = await createPhysics(parkCourse.world);
let course = hillCourse, phys = hillPhys;
const DT = 1 / 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const inside = (a: any, x: number, z: number) => inZone(a, x, z);

// ---- a line round the rocks along a curved trail (u along, offsets to the right: dynamic programming over sideways
// offsets, as the downhill robots do), the probe stretched along the trail's heading
const blockedAlong = (x: number, z: number, yaw: number) => {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  for (const r of [0, 0.3, 0.5]) for (let k = 0; k < (r ? 8 : 1); k++) {
    const a = (k / 8) * Math.PI * 2, ca = r * Math.cos(a) * 1.4, sa = r * Math.sin(a), h = castDown(phys, x + ca * fx - sa * fz, 40, z + ca * fz + sa * fx, 60);
    if (h && (h.surface === 'wall' || h.surface === 'rock')) return true;
  }
  return false;
};
function planAlong(t: any, u0: number, u1: number, spread = 1.1): [number, number][] {
  const N = Math.floor((u1 - u0) / 0.25), D: number[] = [];
  for (let d = -spread; d <= spread + 1e-6; d += 0.1) D.push(d);
  const cost: number[][] = [], from: number[][] = [];
  for (let i = 0; i <= N; i++) {
    const u = u0 + i * 0.25, yaw = t.path.at(u).yaw;
    cost.push([]); from.push([]);
    for (let j = 0; j < D.length; j++) {
      const p = trailPoint(t, u, D[j]), c = (blockedAlong(p.x, p.z, yaw) ? 1e6 : 0) + 0.03 * Math.abs(D[j]);
      if (i === 0) { cost[0].push(c); from[0].push(-1); continue; }
      let best = 1e12, bj = -1;
      for (let k = Math.max(0, j - 1); k <= Math.min(D.length - 1, j + 1); k++) {
        const v = cost[i - 1][k] + 0.4 * Math.abs(k - j);
        if (v < best) { best = v; bj = k; }
      }
      cost[i].push(best + c); from[i].push(bj);
    }
  }
  let j = 0;
  for (let k = 0; k < D.length; k++) if (cost[N][k] < cost[N][j]) j = k;
  const out: [number, number][] = [];
  for (let i = N; i >= 0; i--) { const p = trailPoint(t, u0 + i * 0.25, D[j]); out.push([p.x, p.z]); j = from[i][j]; }
  return out.reverse();
}
// Hairpin Hollow down the middle, from leg 1's start to 4 m past the top, with points as the old line had them: a metre
// apart on the legs and every 15° round the turns
const hm = (await import(`${P}/world/trails/hairpin.ts`)).hairpin().marks;
function hillTrailPath(): [number, number][] {
  const t = course.trails.hairpin, pts: [number, number][] = [];
  let u = 0;
  for (const pc of t.path.pieces) {
    const step = pc.radius !== undefined && Math.abs(pc.turnDeg!) === 180 ? (Math.PI / 12) * pc.radius : 1;
    if (u + pc.len > hm.legs[0][0]) for (let v = Math.max(u, hm.legs[0][0]); v < u + pc.len - 1e-6; v += step) { const p = t.path.at(v); pts.push([p.x, p.z]); }
    u += pc.len;
  }
  const e = t.path.at(t.path.length);
  for (const a of [0, 4]) pts.push([e.x + a * Math.cos(e.yaw), e.z - a * Math.sin(e.yaw)]);
  return pts;
}
// where the bike would be along x on the old park's Switchbacks (the old park is gone; the numbers are what its robot used) (0 at the legs' west ends, 46 at their east ends; the
// switchbacks past the ends), so the hill's robot brakes for the hairpins exactly where the old one did
function oldX(s: any): number {
  const n = course.trails.hairpin.path.nearest(s.pos.x, s.pos.z), legs = hm.legs, R = HAIRPIN.SR, len = HAIRPIN.leg;
  if (n.u < legs[0][0]) return n.u - legs[0][0];
  for (let k = 0; k < legs.length; k++) {
    const [a, b] = legs[k], next = k + 1 < legs.length ? legs[k + 1][0] : Infinity;
    if (n.u <= b) return k % 2 ? len - (n.u - a) : n.u - a;
    if (n.u < next) { const th = (n.u - b) / R; return k % 2 ? -R * Math.sin(th) : len + R * Math.sin(th); }
  }
  return len;
}
const hillHairpinEnd = (s: any) => { const x = oldX(s), len = HAIRPIN.leg; return (x > len - 6 || x < 6) && Math.abs(x) > 1.5; };

// air left: follow the bike's flight forward until it meets the ground
function airLeft(s: any): number {
  let x = s.pos.x, y = s.pos.y, z = s.pos.z, vy = s.vy;
  const vx = Math.cos(s.yaw) * s.speed, vz = -Math.sin(s.yaw) * s.speed;
  for (let t = 0; t < 3; t += 1 / 30) {
    const g = castDown(phys, x, y + 5, z, 30);
    if (g && y <= g.height) return t;
    x += vx / 30; z += vz / 30; y += vy / 30; vy -= T.gDown / 30;
  }
  return 3;
}
interface Style { name: string; stick: (s: any, here: { climb: boolean; loose: boolean }) => number; pop?: boolean; popMax?: number; pump?: boolean; trick?: 'up' | 'down' | null; chain?: number; rest?: boolean }
interface Result { maxWob: number; topAt: number; points: number; lands: string[]; out: string; crashes: number; wobbles: number; burnouts: number; dabs: number; tricks: string[]; short: string[]; top: number; minE: number }

function ride(bike: string, challengeId: string, path: [number, number][], sty: Style, seconds = 120): Result {
  Object.assign(T, DEFAULTS);
  const L = loadoutFor(bike);
  applyLoadout(L);
  const def = CHALLENGES.find((c: any) => c.id === challengeId)!;
  [course, phys] = placeOfStation(def.spot) === 'mesaJumpPark' ? [parkCourse, parkPhys] : [hillCourse, hillPhys];
  T.trickBoost = def.group === 'downhill' ? DOWNHILL_BOOST : 0;
  const st = course.stations[def.spot];
  const s = createLabState(L.spec, st.pos.clone(), st.yaw);
  placeBike(s, st.pos.clone(), st.yaw);
  if (st.speed) s.speed = st.speed;
  const run = startRun(def);
  const r: Result = { maxWob: 0, topAt: 0, points: 0, lands: [], out: 'no result', crashes: 0, wobbles: 0, burnouts: 0, dabs: 0, tricks: [], short: [], top: 0, minE: 1 };
  let idx = 0, held = 0, fromLip = false, resting = false, swiped = 0, prev = { x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: true };
  for (let n = 0; n < seconds / DT; n++) {
    const x = s.pos.x, z = s.pos.z;
    const here = { coast: course.coast.some((a: any) => inside(a, x, z)), climb: course.climb.area.some((a: any) => inZoneHeading(a, x, z, s.yaw)), loose: course.climb.loose.some((a: any) => inside(a, x, z)), rough: course.rough.some((a: any) => inside(a, x, z)) };
    while (idx < path.length - 1 && Math.hypot(path[idx][0] - x, path[idx][1] - z) < 2.2) idx++;
    const [tx, tz] = path[idx];
    const want = Math.atan2(-(tz - z), tx - x);
    const steer = clamp(-wrap(want - s.yaw) * Number(process.env.GAIN ?? 2.5), -1, 1);
    let throttle = sty.stick(s, here);
    if (sty.rest) {
      if (!resting && s.energy < 0.3 && s.grounded && Math.abs(s.slope) < 0.04) resting = true;
      if (resting && s.energy >= 0.8) resting = false;
      if (resting) throttle = -1;
    }
    let hop: number | null = null, crouch = false, swipe: string | null = null;
    if (sty.pop) {
      if (s.grounded && s.slope > 0.15) { held += DT; crouch = true; } else if (held > 0) { hop = Math.min(held, sty.popMax ?? 9); held = 0; }
    }
    if (sty.pump && s.grounded && s.slope < -0.05) crouch = true;
    // a swipe just after takeoff; a chaining style swipes again as soon as a move finishes, up to chain swipes an air
    const left = s.air ? airLeft(s) : 0;
    const needs = (0.8 * (sty.trick === 'down' ? T.flipTime : 0.5)) / s.bike.spin + 0.05; // a move lands once about 80% round
    if (!s.grounded && s.air && s.air.t > 0.04 && swiped < (sty.chain ?? 1) && sty.trick && !s.move && !s.trick && (swiped === 0 || left > needs)) { swipe = sty.trick; swiped++; }
    if (s.grounded) swiped = 0;
    const ev = stepLab(s, { steer, throttle, hop, swipe, again: false, crouch, ...here }, DT, phys, course.lines);
    if (s.speed > r.top) { r.top = s.speed; r.topAt = s.pos.x; }
    r.maxWob = Math.max(r.maxWob, s.wobble);
    r.minE = Math.min(r.minE, s.energy);
    if (!s.grounded && s.air) fromLip = s.air.line !== null;
    if (ev.landed) r.lands.push(`${ev.landed[0]}${ev.airTime ? ev.airTime.toFixed(2) : ''}@${s.pos.x.toFixed(0)}`);
    if (ev.landed === 'wipeout' || ev.landed === 'big') r.crashes++;
    if (ev.wobbleOut) r.wobbles++;
    if (ev.burnt) r.burnouts++;
    if (ev.dab) r.dabs++;
    if (ev.move) r.tricks.push(ev.move);
    if (ev.trick === 'nohander') r.tricks.push('nohander');
    if (ev.short) r.short.push(ev.short);
    const cur = { x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: s.grounded };
    const k: any = { dt: DT, ...trickTick(ev.banked, s.combo), landed: ev.landed, airTime: ev.airTime, fromLip: ev.landed ? fromLip : undefined, move: ev.move, left: !inZone(course.zones[def.spot], cur.x, cur.z) };
    if (def.goal.kind === 'run') k.run = runEvent(def.id, prev, cur, course.runs) ?? undefined;
    prev = cur;
    const res = tick(run, k);
    r.points = run.points; // the challenge's own score (combo totals), as the ride counts it
    if (res.state !== 'running') { r.out = res.state === 'done' ? `done ${run.t.toFixed(1)} s` : `${res.why} @x${s.pos.x.toFixed(0)}`; break; }
  }
  return r;
}
const fmt = (r: Result) => `${r.out.padEnd(22)} pts ${String(Math.round(r.points)).padStart(4)} crashes ${r.crashes} (wobble ${r.wobbles})  burnt ${r.burnouts}  feet ${r.dabs}  top ${Math.round(r.top * 2.237)} mph  minE ${r.minE.toFixed(2)}${r.tricks.length ? '  tricks ' + r.tricks.join(',') : ''}${r.short.length ? '  short ' + r.short.join(',') : ''}${process.env.DEBUG ? `\n    wobble max ${r.maxWob.toFixed(2)}, top at x ${r.topAt.toFixed(0)}; lands ` + r.lands.join(' ') : ''}`;

// near either end of the switchback trail and too quick for a hairpin
const hairpin = (s: any) => hillHairpinEnd(s) && s.speed > 3.5;
const chutePath = planAlong(hillCourse.trails.boulderDash, 1, 150);
const straight = (x0: number, x1: number, z: number): [number, number][] => Array.from({ length: Math.ceil(x1 - x0) }, (_, i) => [x0 + i + 1, z]);
const places: [string, string, [number, number][], Style[]][] = [
  ['chute', 'boulderDash', chutePath, [
    { name: 'stick up the whole way', stick: () => 1 },
    { name: 'cruise, brakes under its wobble speed', stick: (s) => (s.speed > T.wobbleSpeed - 1 ? -1 : 0) },
  ]],
  ['switchbacks', 'hairpinUp', hillTrailPath(), [
    { name: 'full stick', stick: () => 1 },
    { name: 'steady, brakes for hairpins, rests', stick: (s, h) => (hairpin(s) ? -1 : h.loose ? 0.4 : 0), rest: true },
    { name: 'pushes on climbs, brakes for hairpins', stick: (s, h) => (hairpin(s) ? -1 : h.loose ? 0.4 : h.climb ? 0.7 : 0) },
  ]],
  ['rhythm', 'whoop', straight(RHYTHM.x0, RHYTHM.x0 + 80, RHYTHM.z), [
    { name: 'pops, pumps, no-handers', stick: () => 0, pop: true, pump: true, trick: 'up' },
    { name: 'pops and pumps', stick: () => 0, pop: true, pump: true },
    { name: 'small pops, pumps, no-handers', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'up' },
    { name: 'small pops, pumps, backflips', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'down' },
    { name: 'small pops, pumps, two backflips an air', stick: () => 0, pop: true, popMax: 0.08, pump: true, trick: 'down', chain: 2 },
    { name: 'rolls', stick: () => 0 },
  ]],
  ['xl', 'tableXL', straight(-62, 20, XL_LANE), [
    { name: 'sprint, pop, backflip', stick: () => 1, pop: true, trick: 'down' },
    { name: 'sprint, rolled, backflip', stick: () => 1, trick: 'down' },
    { name: 'sprint, pop, no trick', stick: () => 1, pop: true },
  ]],
  ['flips', 'tableBig', straight(-62, 20, LANE.L), [{ name: 'Jumps L: sprint, pop, backflip', stick: () => 1, pop: true, trick: 'down' }]],
  ['flips', 'tableMedium', straight(-62, 40, LANE.M), [{ name: 'Jumps M: sprint, pop, backflip', stick: () => 1, pop: true, trick: 'down' }]],
];
for (const [place, id, path, styles] of places) {
  if (ONLY && ONLY !== place) continue;
  console.log(`\n== ${place}`);
  for (const sty of styles) for (const bike of BIKES) console.log(`${bike.padEnd(10)} ${sty.name.padEnd(42)} ${fmt(ride(bike, id, path, sty))}`);
}
