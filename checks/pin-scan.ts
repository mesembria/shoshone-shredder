// Looks for places where a bike can be pinned for good: stand it on a grid of spots and headings around a trail, try
// every control it has (push, coast, brake, steer either way, and a wiggle) for a few seconds each, and report the
// poses from which none of them gets it more than a metre away. There is no reverse, so a pose like that is a trap.
//   npx vite-node checks/pin-scan.ts [trailName] [bike] [u0] [u1]       (trailName: goatDown, goatUp, hairpin, boulderDash ...)
const P = new URL('../src', import.meta.url).pathname;
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { trailPoint, inZone } = await import(`${P}/world/trail.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { fitsTilted } = await import(`${P}/lab/body.ts`);
const { LAB_BIKES, applyBike } = await import(`${P}/lab/bikes.ts`);
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
const THREE = await import('three');

const which = process.argv[2] ?? 'goatDown', bikeId = (process.argv[3] ?? 'enduro') as keyof typeof LAB_BIKES;
const course = buildPlace('shredderHills');
const phys = await createPhysics(course.world);
const trail = course.trails[which];
Object.assign(T, DEFAULTS);
applyBike(bikeId);

const flag = (k: 'area' | 'loose', x: number, z: number) => course.climb[k].some((a: any) => inZone(a, x, z));
const policies: [number, number][] = [[1, 0], [1, 1], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, -1], [0.3, 0]];

// true when some control sequence gets the bike more than a metre from `pos` within `secs`
function escapes(pos: any, yaw: number, secs = 3): boolean {
  for (const [throttle, steer] of policies) for (const wiggle of [false, true]) {
    const s = createLabState(LAB_BIKES[bikeId], pos.clone(), yaw);
    placeBike(s, pos.clone(), yaw);
    for (let i = 0; i < secs * 60; i++) {
      const st = wiggle ? (Math.floor(i / 20) % 2 ? -steer : steer) : steer;
      stepLab(s, { steer: st, throttle, hop: null, swipe: null, again: false, crouch: false, climb: flag('area', s.pos.x, s.pos.z), loose: flag('loose', s.pos.x, s.pos.z), rough: course.rough.some((a: any) => inZone(a, s.pos.x, s.pos.z)) }, 1 / 60, phys, course.lines);
      if (s.crash) break;
      if (s.pos.distanceTo(pos) > 1) return true;
    }
  }
  return false;
}

const traps: { u: number; off: number; yawDeg: number; rel: number; x: number; z: number }[] = [];
let tried = 0;
const len = trail.path.length, half = trail.width / 2;
const U0 = Number(process.argv[4] ?? 2), U1 = Math.min(len - 2, Number(process.argv[5] ?? len));
for (let u = U0; u < U1; u += 0.3) for (let off = -half - 1.6; off <= half + 1.6; off += 0.2) {
  const p = trailPoint(trail, u, off), g = castDown(phys, p.x, p.y + 20, p.z, 60);
  if (!g) continue;
  const pos = new THREE.Vector3(p.x, g.height, p.z);
  for (let k = 0; k < 12; k++) {
    const yaw = (k / 12) * Math.PI * 2;
    if (!fitsTilted(phys, pos, yaw, 0)) continue;
    tried++;
    if (!escapes(pos, yaw)) traps.push({ u: +u.toFixed(1), off: +off.toFixed(1), yawDeg: Math.round((yaw * 180) / Math.PI), rel: Math.round((((yaw - trail.path.at(u).yaw) * 180) / Math.PI + 540) % 360 - 180), x: +pos.x.toFixed(2), z: +pos.z.toFixed(2) });
  }
}
console.log(`${which}, ${bikeId}: ${tried} poses tried, ${traps.length} pins`);
const byU = new Map<number, number>();
for (const t of traps) byU.set(Math.round(t.u), (byU.get(Math.round(t.u)) ?? 0) + 1);
console.log('pins per metre of trail:', [...byU].map(([u, n]) => `${u}:${n}`).join(' '));
console.log('RELJSON ' + JSON.stringify(traps));
