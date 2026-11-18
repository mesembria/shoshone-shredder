// Robot riders down the descent: plan a line round the rocks, ride it at a style of speed, hop the log (or not),
// and log every landing, crash and the top speed, on Goat Ladder's descent on Shredder Hills, planned along the curved
// trail; it also gives each run's time from the start to the bottom.
const P = new URL('../src', import.meta.url).pathname;
const TIMES = true;
const THREE = await import('three');
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { ledgeAhead, trailPoint } = await import(`${P}/world/trail.ts`);
const { pathSteer, steerToward, pastEnd } = await import('./follow.ts');
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const { LAB_BIKES, applyBike } = await import(`${P}/lab/bikes.ts`);
const bike = process.env.BIKE ?? 'bolinas'; // BIKE=hardtail, dirtjumper or enduro rides another lab bike
if (!LAB_BIKES[bike]) throw new Error(`no lab bike ${bike}`);
const { loadout, applyLoadout, PARTS: CATALOG } = await import(`${P}/game/catalog.ts`);
// PARTS=stock (the default), all (every upgrade; the first where a slot has two) or a list of part ids
const loadoutFor = (b: string) => {
  const want = process.env.PARTS ?? 'stock', ups = CATALOG.filter((x: any) => x.bike === b && !x.stock);
  const pick = want === 'stock' ? [] : want === 'all' ? ups.filter((x: any, i: number) => ups.findIndex((y: any) => y.slot === x.slot) === i) : ups.filter((x: any) => want.split(',').includes(x.id));
  return loadout(b, Object.fromEntries(pick.map((x: any) => [x.slot, x.id])));
};
const L = loadoutFor(bike);
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
const course = buildPlace('shredderHills');
console.log(`bike: ${LAB_BIKES[bike].name} (${Object.values(L.fitted).join(', ')})`);
const phys = await createPhysics(course.world);
const C = course.climb;
// the descent is one trail, starting with the summit hairpin; the robots start just past it
const down = course.trails.goatDown, U0 = Math.PI * 3.5 + 1;
const logAlong = (L: any, x: number, z: number) => Math.abs((x - L.pos.x) * Math.cos(L.yaw) - (z - L.pos.z) * Math.sin(L.yaw));
const blockedAlong = (x: number, z: number, yaw: number) => {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  for (const r of [0, 0.3, 0.55]) for (let k = 0; k < (r ? 10 : 1); k++) {
    const a = (k / 10) * Math.PI * 2, ca = r * Math.cos(a) * 1.6, sa = r * Math.sin(a), px = x + ca * fx - sa * fz, pz = z + ca * fz + sa * fx;
    const h = castDown(phys, px, 30, pz, 40);
    if (h && (h.surface === 'wall' || (h.surface === 'rock' && !C.ledges.some((L: any) => L.log && logAlong(L, px, pz) < 1.5)))) return true;
  }
  return false;
};
// the same line planning along the hill's descent, u0 to u1, and on past its end onto the flat
function planTrail(u0: number, u1: number): [number, number][] {
  const N = Math.floor((u1 - u0) / 0.25), D: number[] = [];
  for (let d = -1.2; d <= 1.2001; d += 0.1) D.push(d);
  const cost: number[][] = [], from: number[][] = [];
  for (let i = 0; i <= N; i++) {
    const u = u0 + i * 0.25, yaw = down.path.at(u).yaw, onTrail = u <= down.path.length;
    cost.push([]); from.push([]);
    for (let j = 0; j < D.length; j++) {
      const p = trailPoint(down, u, D[j]);
      const c = (onTrail && blockedAlong(p.x, p.z, yaw) ? 1e6 : 0) + 0.03 * Math.abs(D[j]);
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
  for (let i = N; i >= 0; i--) {
    const u = u0 + i * 0.25, p = u <= down.path.length ? trailPoint(down, u, D[j]) : pastEnd(down, u);
    out.push([p.x, p.z]);
    j = from[i][j];
  }
  return out.reverse();
}
type Style = { name: string; stick: (v: number) => number; hopAt: [number, number] | null; straight?: boolean; pop?: boolean };
const styles: Style[] = [
  { name: 'cruise, hops the log', stick: () => 0, hopAt: [0.6, 2.2] },
  { name: 'cruise, pops the lips too', stick: () => 0, hopAt: [0.6, 2.2], pop: true },
  { name: 'cruise, never hops', stick: () => 0, hopAt: null },
  { name: 'brakes to 7 m/s, never hops', stick: (v) => (v > 7 ? -1 : 0), hopAt: null },
  { name: 'brakes to 7, hops after stopping', stick: (v) => (v > 7 ? -1 : 0), hopAt: null, hopStopped: true } as any,
  { name: 'brakes to 7 m/s, hops', stick: (v) => (v > 7 ? -1 : 0), hopAt: [0.6, 2.2] },
  { name: 'stick up the whole way, hops', stick: () => 1, hopAt: [0.6, 2.2] },
  { name: 'cruise, straight down the middle', stick: () => 0, hopAt: [0.6, 2.2], straight: true },
];
for (const sty of styles) {
  if (process.argv[2] && sty.name !== process.argv[2]) continue;
  Object.assign(T, DEFAULTS);
  applyLoadout(L);
  const pts = sty.straight ? [] : planTrail(U0, down.path.length + 13);
  const p0 = trailPoint(down, U0), yaw0 = down.path.at(U0).yaw;
  const x0 = p0.x, z0 = p0.z, y0 = castDown(phys, x0, 30, z0, 40)!.height;
  const s = createLabState(L.spec, new THREE.Vector3(x0, y0, z0), yaw0);
  placeBike(s, new THREE.Vector3(x0, y0, z0), yaw0);
  s.speed = 3;
  let vmax = 0, idx = 0, hopped = false, popped = new Set<number>(), bottom = 0, t = 0;
  const log: string[] = [];
  for (let i = 0; i < 60 * 40 && !bottom; i++) {
    let best = idx, bd = 1e9;
    for (let k = idx; k < Math.min(pts.length, idx + 60); k++) { const d = (pts[k][0] - s.pos.x) ** 2 + (pts[k][1] - s.pos.z) ** 2; if (d < bd) { bd = d; best = k; } }
    idx = best;
    const look = Math.max(6, Math.round(s.speed * 1.2)), tgt = pts[Math.min(pts.length - 1, best + look)];
    // the straight robot follows the centreline as far ahead as the old one aimed (points 0.25 m apart)
    const steer = sty.straight ? pathSteer(down, s.pos.x, s.pos.z, s.yaw, look * 0.25) : steerToward(s.pos.x, s.pos.z, s.yaw, tgt[0], tgt[1]);
    let hop: number | null = null;
    const L = C.ledges.find((l: any) => l.log);
    const ahead = ledgeAhead(L, s.pos.x, s.pos.z, s.yaw) - 0.55;
    if (sty.hopAt && !hopped && s.grounded && ahead > sty.hopAt[0] && ahead < sty.hopAt[0] + (sty.hopAt[1] - sty.hopAt[0]) * Math.min(1, s.speed / 10)) { hop = 0.05; hopped = true; }
    if ((sty as any).hopStopped && s.grounded && s.speed < 0.3 && Math.abs(ahead) < 0.6) hop = 0.05;
    if (sty.pop) course.lines.forEach((ln: any, n: number) => {
      // how far past the lip along the way it's ridden (what the old check measured along x), and how far to its side
      const fx = Math.cos(ln.yaw), fz = -Math.sin(ln.yaw), dx = ln.lip.x - s.pos.x, dz = ln.lip.z - s.pos.z, a = -(dx * fx + dz * fz);
      if (Math.abs(dx * -fz + dz * fx) < 2 && a > 0 && a < 0.6 && !popped.has(n) && s.grounded) { hop = 0.05; popped.add(n); }
    });
    const ev = stepLab(s, { steer, throttle: sty.stick(s.speed), hop, swipe: null, again: false, crouch: false, climb: false, loose: false }, 1 / 60, phys, course.lines);
    vmax = Math.max(vmax, s.speed);
    if (process.argv[2] && sty.name === process.argv[2] && s.pos.x < 72 && s.pos.x > 64 && i % 2 === 0) console.log('  ', s.pos.x.toFixed(2), s.pos.z.toFixed(2), 'y', s.pos.y.toFixed(2), 'v', s.speed.toFixed(1), s.grounded ? 'G' : 'air', [ev.bump && 'BUMP', ev.wallStop && 'stop', ev.landed].filter(Boolean).join(' '));
    // where: u along the descent from its old start (and the sideways offset for crashes)
    const n = down.path.nearest(s.pos.x, s.pos.z), at = `u${(n.u - U0 + 1).toFixed(0)}`;
    if (ev.landed && (ev.airTime ?? 0) > 0.2) log.push(`${ev.landed}${ev.landed === 'clean' || ev.landed === 'bobble' ? '' : '!'}(${(ev.airTime ?? 0).toFixed(2)}s)@${at}`);
    if (s.crash && !log.at(-1)?.startsWith('CRASH')) log.push(`CRASH-${s.crash.outcome}@${at},${n.off.toFixed(1)}`);
    t += 1 / 60;
    const far = down.path.nearest(s.pos.x, s.pos.z).u > U0 + 39;
    if (s.pos.y < 0.1 && s.grounded && far) bottom = down.path.nearest(s.pos.x, s.pos.z).u - U0 + 1;
  }
  const where = bottom ? `bottom at u ${bottom.toFixed(0)}` : `stopped at u ${(down.path.nearest(s.pos.x, s.pos.z).u - U0 + 1).toFixed(0)}`;
  console.log(`${sty.name.padEnd(34)} top ${(vmax * 2.237).toFixed(0)} mph  ${where}${TIMES && bottom ? ` in ${t.toFixed(1)} s` : ''}  ${log.join(' ')}`);
}
{
  const u = (x: number, z: number) => (down.path.nearest(x, z).u - U0 + 1).toFixed(1); // along the old descent, from its start
  const lg = C.ledges.find((l: any) => l.log);
  console.log('log at u', u(lg.pos.x, lg.pos.z), ' lips at u', course.lines.map((l: any) => u(l.lip.x, l.lip.z)).join(' '));
}
