// Shortcut robots on Hairpin Hollow ↓: from the start line, ignore the trail and ride straight down the hill toward
// the finish line, at a range of top speeds and aims. Reports each run's time (start line to finish line, the same
// gates the game uses), crashes, and whether the bike ever ended a step overlapping something or got stuck.
//   npx vite-node checks/hairpin-cut.ts [bike]
const P = new URL('../src', import.meta.url).pathname;
const THREE = await import('three');
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { trailPoint } = await import(`${P}/world/trail.ts`);
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
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
let best = Infinity, overlaps = 0, stucks = 0, traps = 0;
for (const vmax of (process.env.V ?? "5,6,7,8,9,10,11,12,14").split(",").map(Number)) for (const aim of (process.env.AIM ?? "-6,-3,0,3,6").split(",").map(Number)) {
  const s: any = createLabState(LAB_BIKES[bikeId], new THREE.Vector3(p0.x, g0.height, p0.z), yaw0);
  placeBike(s, new THREE.Vector3(p0.x, g0.height, p0.z), yaw0);
  let started: number | null = null, done: number | null = null, crashes = 0, wasCrash = false, overlap = 0;
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
    if (ev === 'start' && started === null) started = tsec;
    if (ev === 'finish' && started !== null) done = tsec - started;
    still = Math.hypot(cur.x - prev.x, cur.z - prev.z) < 0.003 && !s.crash ? still + 1 : 0;
    if (still > 180 && !stuckAt) { stuckAt = { x: +cur.x.toFixed(1), z: +cur.z.toFixed(1), fits: fitsTilted(phys, s.pos, s.yaw, s.pitch), escapes: escapes(s.pos.clone(), s.yaw) }; if (!stuckAt.escapes) { traps++; console.log('TRAP POSE', JSON.stringify({ x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw, pitch: s.pitch })); } break; }
    if (process.env.TRACE === '2' && i % 60 === 0) console.log(tsec, cur.x.toFixed(1), cur.z.toFixed(1), "spd", s.speed.toFixed(1), "toFinish", Math.hypot(finish.x - cur.x, finish.z - cur.z).toFixed(1), "yaw", s.yaw.toFixed(2), "want", want.toFixed(2), "crash", !!s.crash);
    prev = cur;
  }
  if (done !== null) best = Math.min(best, done);
  overlaps += overlap ? 1 : 0;
  stucks += stuckAt ? 1 : 0;
  const stars = done === null ? '-' : done <= times[2] ? '3★' : done <= times[1] ? '2★' : done <= times[0] ? '1★' : '0★';
  console.log(`v${vmax} aim${aim}: ${done === null ? `no finish (started ${started}, ends ${Math.hypot(finish.x - s.pos.x, finish.z - s.pos.z).toFixed(1)} m from finish, at ${s.pos.x.toFixed(1)},${s.pos.z.toFixed(1)})` : done.toFixed(2) + ' s ' + stars}, crashes ${crashes}${overlap ? `, OVERLAPPING ${overlap} steps` : ''}${stuckAt ? `, STUCK at ${JSON.stringify(stuckAt)} yaw ${s.yaw.toFixed(3)}` : ''}`);
}
console.log(`best ${best.toFixed(2)} s; runs with overlap ${overlaps}, runs stuck ${stucks}, of them traps (no control gets out) ${traps}`);
