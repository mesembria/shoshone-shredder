// Shortcut robots on Hairpin Hollow ↓: from the start line, ignore the trail and ride straight down the hill toward
// the finish line, at a range of top speeds and aims. Reports each run's time (start line to finish line, the same
// gates the game uses), crashes, and whether the bike ever ended a step overlapping something or got stuck. The robot
// rides by the game's rule, stay on the trail: a cut crashes it back where it left the route, so it reports its cuts,
// whether it finished, and whether that beat 3★.
//   npx vite-node checks/hairpin-cut.ts [bike]
// CORNERS=1: for each switchback on the route, start on it 12 m before the turn, aim straight for the route 12 m after
// the turn, and report the route metres gained over the metres actually ridden (and the seconds, at the speed ridden),
// and whether a cut fired.
const P = new URL('../src', import.meta.url).pathname;
const THREE = await import('three');
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { trailPoint } = await import(`${P}/world/trail.ts`);
const { createLabState, placeBike, stepLab, crashBack } = await import(`${P}/lab/bike.ts`);
const { startTrack, routeTick } = await import(`${P}/game/stayOnTrail.ts`);
const { routePoint, routeLength } = await import(`${P}/world/route.ts`);
const { fitsTilted } = await import(`${P}/lab/body.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const { LAB_BIKES, applyBike } = await import(`${P}/lab/bikes.ts`);
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
const { runEvent } = await import(`${P}/game/spots.ts`);
const { hairpin } = await import(`${P}/world/trails/hairpin.ts`);
const { CHALLENGES } = await import(`${P}/game/challenges.ts`);
(globalThis as any).__dbg = !!process.env.TRACE;
const bikeId = (process.argv[2] ?? 'hardtail') as keyof typeof LAB_BIKES;
const course = buildPlace('shredderHills');
const phys = await createPhysics(course.world);
Object.assign(T, DEFAULTS);
applyBike(bikeId);
const t = course.trails.hairpin, m = hairpin().marks;
const times = CHALLENGES.find((c: any) => c.id === (process.env.RUN ?? 'hairpinDown')).goal.times;
// RUN=goatDown (or any timed run): start 1.5 m behind its start line, aim for its finish line and on through it
const RUN = process.env.RUN ?? 'hairpinDown', gates = course.runs[RUN];
const mid = (g: any) => new THREE.Vector3((g.a.x + g.b.x) / 2, 0, (g.a.y + g.b.y) / 2);
const fwd = (g: any) => new THREE.Vector3(-(g.b.y - g.a.y), 0, g.b.x - g.a.x).normalize();
const sm = mid(gates.start), sf = fwd(gates.start), fm = mid(gates.finish), ff = fwd(gates.finish);
const p0 = sm.clone().addScaledVector(sf, -1.5), yaw0 = Math.atan2(-sf.z, sf.x);
const g0 = castDown(phys, p0.x, 200, p0.z, 400)!;
const finish = fm.clone().addScaledVector(ff, -1.5), past = fm.clone().addScaledVector(ff, 4);
const startAim = sm.clone().addScaledVector(sf, 3);
console.log(`${RUN}, ${bikeId}: 2★ ${times[1]} s, 3★ ${times[2]} s; straight line ${Math.hypot(finish.x - p0.x, finish.z - p0.z).toFixed(0)} m `);
// from a stuck pose, can any control sequence get the bike a metre away? (pin-scan's test: push, coast, brake, steer
// either way and a wiggle, 3 s each). A stuck pose with no way out is a trap; one with a way out is just this robot.
const policies: [number, number][] = [[1, 0], [1, 1], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, -1], [0.3, 0]];
function escapes(pos: any, yaw: number): boolean {
  for (const [throttle, steer] of policies) for (const wiggle of [false, true]) {
    const e: any = createLabState(LAB_BIKES[bikeId], pos.clone(), yaw);
    placeBike(e, pos.clone(), yaw);
    for (let i = 0; i < 180; i++) {
      stepLab(e, { steer: wiggle && Math.floor(i / 20) % 2 ? -steer : steer, throttle, hop: null, swipe: null, again: false, crouch: false }, 1 / 60, phys, course.lines);
      if (e.crash) break;
      if (e.pos.distanceTo(pos) > 1) return true;
    }
  }
  return false;
}
if (process.env.CORNERS) {
  const route = gates.route, len = routeLength(route), vmax = Number(process.env.V ?? 8);
  // a switchback: the route turns more than 115° over 12 m; consecutive such points are one turn
  const turnAt = (d: number) => { const a = routePoint(route, d - 6).yaw, b = routePoint(route, d + 6).yaw; return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) > 2; };
  const turns: [number, number][] = [];
  for (let d = 18; d < len - 18; d += 0.5) if (turnAt(d)) { const last = turns[turns.length - 1]; if (last && d - last[1] <= 1) last[1] = d; else turns.push([d, d]); }
  let gainM = 0, gainS = 0, cutN = 0;
  for (const [dA, dB] of turns) {
    const from = routePoint(route, dA - 12), to = routePoint(route, Math.min(len, dB + 12)).pos;
    const g = castDown(phys, from.pos.x, from.pos.y + 20, from.pos.z, 60)!;
    const s: any = createLabState(LAB_BIKES[bikeId], new THREE.Vector3(from.pos.x, g.height, from.pos.z), from.yaw);
    placeBike(s, new THREE.Vector3(from.pos.x, g.height, from.pos.z), from.yaw);
    s.speed = Math.min(vmax, 6);
    const track = startTrack(route);
    track.furthest = dA - 12;
    let ridden = 0, cut = false, prev = { x: s.pos.x, z: s.pos.z }, i = 0;
    for (; i < 60 * 20 && Math.hypot(to.x - s.pos.x, to.z - s.pos.z) > 1.5; i++) {
      const want = Math.atan2(-(to.z - s.pos.z), to.x - s.pos.x), d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
      stepLab(s, { steer: Math.max(-1, Math.min(1, -d * 2)), throttle: s.speed > vmax ? -1 : 1, hop: null, swipe: null, again: false, crouch: false }, 1 / 60, phys, course.lines);
      ridden += Math.hypot(s.pos.x - prev.x, s.pos.z - prev.z);
      const c = routeTick(track, s, prev, false);
      prev = { x: s.pos.x, z: s.pos.z };
      if (c.cut) { cut = true; break; }
    }
    const gain = track.furthest - (dA - 12) - ridden, v = ridden / Math.max(i / 60, 1e-6);
    if (!cut) { gainM += gain; gainS += gain / Math.max(v, 0.1); } else cutN++;
    console.log(`turn ${dA.toFixed(0)}–${dB.toFixed(0)} m: ${cut ? `CUT (got to ${track.furthest.toFixed(1)})` : `gained ${gain.toFixed(1)} m route over ${ridden.toFixed(1)} m ridden, ${(gain / Math.max(v, 0.1)).toFixed(2)} s at ${v.toFixed(1)} m/s`}`);
  }
  console.log(`${turns.length} switchbacks: ${cutN} cut; the rest gained ${gainM.toFixed(1)} m, ${gainS.toFixed(2)} s in all`);
  process.exit(0);
}
let best = Infinity, overlaps = 0, stucks = 0, traps = 0, cutsAll = 0, under3 = 0;
for (const vmax of (process.env.V ?? "5,6,7,8,9,10,11,12,14").split(",").map(Number)) for (const aim of (process.env.AIM ?? "-6,-3,0,3,6").split(",").map(Number)) {
  const s: any = createLabState(LAB_BIKES[bikeId], new THREE.Vector3(p0.x, g0.height, p0.z), yaw0);
  placeBike(s, new THREE.Vector3(p0.x, g0.height, p0.z), yaw0);
  let started: number | null = null, done: number | null = null, crashes = 0, wasCrash = false, overlap = 0, cuts = 0, track: any = null;
  let prev = { x: s.pos.x, z: s.pos.z }, still = 0, stuckAt: any = null, lastState: any = null, lastCrashT = -1;
  const side = new THREE.Vector3(-(finish.z - p0.z), 0, finish.x - p0.x).normalize();
  for (let i = 0; i < 60 * 90 && done === null; i++) {
    const tsec = i / 60;
    // aim at the finish (offset sideways by `aim` m until close), then on through it
    const near = Math.hypot(finish.x - s.pos.x, finish.z - s.pos.z) < 6 || started === null ? 0 : 1;
    const tgt = started === null ? startAim : Math.hypot(finish.x - s.pos.x, finish.z - s.pos.z) < 3 ? past : new THREE.Vector3(finish.x + side.x * aim * near, 0, finish.z + side.z * aim * near);
    const want = Math.atan2(-(tgt.z - s.pos.z), tgt.x - s.pos.x), d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    stepLab(s, { steer: Math.max(-1, Math.min(1, -d * 2)), throttle: s.speed > vmax ? -1 : 1, hop: null, swipe: null, again: false, crouch: false }, 1 / 60, phys, course.lines);
    if (s.crash && !wasCrash) crashes++;
    wasCrash = !!s.crash;
    if (!s.crash && s.grounded && !fitsTilted(phys, s.pos, s.yaw, s.pitch)) {
      if (!overlap && process.env.TRACE) console.log('first overlap', tsec.toFixed(2), JSON.stringify({ x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw, pitch: s.pitch, speed: s.speed, surface: s.surface, crashT: lastCrashT }), 'last', JSON.stringify(lastState));
      overlap++;
    }
    lastState = { x: +s.pos.x.toFixed(3), y: +s.pos.y.toFixed(3), z: +s.pos.z.toFixed(3), yaw: +s.yaw.toFixed(3), pitch: +s.pitch.toFixed(3), grounded: s.grounded, crash: !!s.crash, fits: fitsTilted(phys, s.pos, s.yaw, s.pitch) };
    if (s.crash) lastCrashT = tsec;
    const cur = { x: s.pos.x, z: s.pos.z }, ev = runEvent(RUN, prev, cur, course.runs);
    if (ev === 'start' && started === null) { started = tsec; track = startTrack(gates.route); }
    else if (track) {
      // stay on the trail, as main.ts does it
      const c = routeTick(track, s, prev, ev === 'finish');
      if (c.finish) done = tsec - started!;
      if (c.cut) { crashBack(s, c.at); cuts++; }
    }
    still = Math.hypot(cur.x - prev.x, cur.z - prev.z) < 0.003 && !s.crash ? still + 1 : 0;
    if (still > 180 && !stuckAt) { stuckAt = { x: +cur.x.toFixed(1), z: +cur.z.toFixed(1), fits: fitsTilted(phys, s.pos, s.yaw, s.pitch), escapes: escapes(s.pos.clone(), s.yaw) }; if (!stuckAt.escapes) { traps++; console.log('TRAP POSE', JSON.stringify({ x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw, pitch: s.pitch })); } break; }
    if (process.env.TRACE === '2' && i % 60 === 0) console.log(tsec, cur.x.toFixed(1), cur.z.toFixed(1), "spd", s.speed.toFixed(1), "toFinish", Math.hypot(finish.x - cur.x, finish.z - cur.z).toFixed(1), "yaw", s.yaw.toFixed(2), "want", want.toFixed(2), "crash", !!s.crash);
    prev = cur;
  }
  if (done !== null) best = Math.min(best, done);
  cutsAll += cuts;
  if (done !== null && done <= times[2]) under3++;
  overlaps += overlap ? 1 : 0;
  stucks += stuckAt ? 1 : 0;
  const stars = done === null ? '-' : done <= times[2] ? '3★' : done <= times[1] ? '2★' : done <= times[0] ? '1★' : '0★';
  console.log(`v${vmax} aim${aim}: ${done === null ? `no finish (started ${started}, ends ${Math.hypot(finish.x - s.pos.x, finish.z - s.pos.z).toFixed(1)} m from finish, at ${s.pos.x.toFixed(1)},${s.pos.z.toFixed(1)})` : done.toFixed(2) + ' s ' + stars}, crashes ${crashes}, cuts ${cuts}${done !== null && done <= times[2] ? ' BEATS 3★' : ''}${overlap ? `, OVERLAPPING ${overlap} steps` : ''}${stuckAt ? `, STUCK at ${JSON.stringify(stuckAt)} yaw ${s.yaw.toFixed(3)}` : ''}`);
}
console.log(`best ${best.toFixed(2)} s; cuts ${cutsAll}; runs under 3★ ${under3}; runs with overlap ${overlaps}, runs stuck ${stucks}, of them traps (no control gets out) ${traps}`);
