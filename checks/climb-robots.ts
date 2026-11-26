// Robot riders up the long climb. Each plans a line along the three legs by probing the ground for rocks,
// weaving round them, then rides it with a style: how much stick on dirt and on gravel, whether it hops ledges,
// and which side it takes where the gravel and a ledge split the trail. It rides Goat Ladder on Shredder Hills: the line
// is planned along the curved trail (sideways offsets from its centreline).
const P = new URL('../src', import.meta.url).pathname;
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { inZone, ledgeAhead, trailPoint } = await import(`${P}/world/trail.ts`);
const { pathSteer, steerToward, blockedProbe, offsetsAcross, planLine } = await import('./follow.ts');
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const { BIKES } = await import(`${P}/rules/bikes.ts`);
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
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
console.log(`bike: ${LAB_BIKES[bike].name} (${Object.values(L.fitted).join(', ')})`);
const course = buildPlace('shredderHills');
const phys = await createPhysics(course.world);
const st = course.stations.Climb;
const C = course.climb;
const SR = 3.5;
const inside = (a: any, x: number, z: number) => inZone(a, x, z);
// the climb is one trail; its switchbacks are its two tight arcs
const up = course.trails.goatUp, TURN = Math.PI * SR;
const hairpins: number[] = [];
{ let u = 0; for (const pc of up.path.pieces) { if (pc.radius === SR) hairpins.push(u); u += pc.len; } }
const onHairpin = (u: number, pad = 0) => hairpins.some((h) => u > h - pad && u < h + TURN + pad);
// the probe for rocks, stretched along the trail's heading
const blockedAlong = blockedProbe(phys, { r1: 1.3, rMax: 0.55, n: 10, from: 20, depth: 40 });
// dynamic programming over sideways offsets
let WIDE = 0;
// best line along the curved climb, u0 to u1, held to the middle on the switchbacks as the old robot rode them
const planTrail = (t: any, u0: number, u1: number, loosePref: number): [number, number][] =>
  planLine(u0, u1, offsetsAcross(1.2 + WIDE), (u, d) => {
    const p = trailPoint(t, u, d), mid = onHairpin(u) ? 100 : 0;
    return (blockedAlong(p.x, p.z, t.path.at(u).yaw) ? 1e6 : 0) + (WIDE ? (Math.abs(d) > 1.6 ? -0.3 : 0) : 0.03 * Math.abs(d)) + (C.loose.some((a: any) => inside(a, p.x, p.z)) ? loosePref : 0) + mid * Math.abs(d);
  }, (u, d) => { const p = trailPoint(t, u, d); return [p.x, p.z]; }, { window: 2, startBias: 2 });
const path = (loosePref: number) => planTrail(up, 1, up.path.length, loosePref);
const cross = (p: number[], q: number[], g: any) => {
  const side = (o: number[], u: number[], v: number[]) => Math.sign((u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]));
  const a = [g.a.x, g.a.y], b = [g.b.x, g.b.y];
  return side(p, q, a) !== side(p, q, b) && side(a, b, p) !== side(a, b, q);
};
type Style = { name: string; dirt: number; gravel: number; hopAt: number | null; loosePref: number; straight?: boolean };
const styles: Style[] = [
  { name: 'smart, takes the gravel side', dirt: 1, gravel: 0.35, hopAt: 0.75, loosePref: -0.05 },
  { name: 'smart, takes the ledge side', dirt: 1, gravel: 0.35, hopAt: 0.75, loosePref: 0.3 },
  { name: 'smart but lets go on gravel', dirt: 1, gravel: 0, hopAt: 0.75, loosePref: -0.05 },
  { name: 'steady (stick a quarter up)', dirt: Number(process.env.STEADY ?? 0.25), gravel: 0.35, hopAt: 0.75, loosePref: -0.05 },
  { name: 'stick up the whole way', dirt: 1, gravel: 1, hopAt: 0.75, loosePref: -0.05 },
  { name: 'cruise everywhere', dirt: 0, gravel: 0, hopAt: 0.75, loosePref: -0.05 },
  { name: 'smart, hops only after a bonk', dirt: 1, gravel: 0.35, hopAt: null, loosePref: -0.05 },
  { name: 'cheater: rides the grass where it can', dirt: 1, gravel: 0.35, hopAt: 0.75, loosePref: 0, cheat: true } as any,
  { name: 'smart, rides straight up the middle', dirt: 1, gravel: 0.35, hopAt: 0.75, loosePref: 0, straight: true },
];
const only = process.argv[2];
for (const sty of styles) {
  if (only && !sty.name.includes(only)) continue;
  Object.assign(T, DEFAULTS);
  applyLoadout(L);
  WIDE = (sty as any).cheat ? 2.2 : 0;
  const pts = sty.straight ? [] : path(sty.loosePref);
  const s = createLabState(L.spec, st.pos.clone(), st.yaw);
  placeBike(s, st.pos.clone(), st.yaw);
  let burnt = 0, minE = 1, t = 0, started = false, done = '', spin = 0, minV = 99, idx = 0, offTrail: number | undefined;
  const log: string[] = [], hopped = new Set<number>();
  for (let i = 0; i < 60 * 150 && !done; i++) {
    let best = idx, bd = 1e9;
    for (let k = idx; k < Math.min(pts.length, idx + 40); k++) { const d = (pts[k][0] - s.pos.x) ** 2 + (pts[k][1] - s.pos.z) ** 2; if (d < bd) { bd = d; best = k; } }
    idx = best;
    const tgt = pts[Math.min(pts.length - 1, best + 6)];
    // the straight robot follows the centreline 1.5 m ahead (the old one aimed 6 points of 0.25 m ahead)
    const steer = sty.straight ? pathSteer(up, s.pos.x, s.pos.z, s.yaw, 1.5) : steerToward(s.pos.x, s.pos.z, s.yaw, tgt[0], tgt[1]);
    const climb = C.area.some((a: any) => inside(a, s.pos.x, s.pos.z)), loose = C.loose.some((a: any) => inside(a, s.pos.x, s.pos.z));
    let hop: number | null = null;
    C.ledges.forEach((L: any, n: number) => {
      const ahead = ledgeAhead(L, s.pos.x, s.pos.z, s.yaw) - 0.55; // Infinity when not lined up for it
      if (sty.hopAt === null && s.dab > 0 && Math.abs(ahead) < 0.4) { hop = 0.05; return; }
      if (sty.hopAt !== null && !hopped.has(n) && s.grounded && ahead > 0 && ahead < sty.hopAt && Math.abs(s.pos.y - L.pos.y) < 1) { hop = 0.05; hopped.add(n); }
    });
    const p = [s.pos.x, s.pos.z];
    const ev = stepLab(s, { steer, throttle: loose ? sty.gravel : sty.dirt, hop, swipe: null, again: false, crouch: false, climb, loose }, 1 / 60, phys, course.lines);
    const q = [s.pos.x, s.pos.z];
    if (process.env.TRACE2 && i / 60 > Number(process.env.T0 ?? 5.3) && i / 60 < Number(process.env.T1 ?? 6.0)) console.log(`x ${s.pos.x.toFixed(3)} y ${s.pos.y.toFixed(3)} z ${s.pos.z.toFixed(3)} yaw ${s.yaw.toFixed(3)} pitch ${s.pitch.toFixed(3)} v ${s.speed.toFixed(2)} ev ${JSON.stringify(ev)}`);
    if (process.env.TRACE && i % 30 === 0) console.log(`t ${(i / 60).toFixed(1)} x ${s.pos.x.toFixed(2)} v ${s.speed.toFixed(2)} e ${s.energy.toFixed(2)} burnt ${s.burnt} rest ${s.burntRest} dab ${s.dab.toFixed(2)} resting ${s.resting} grounded ${s.grounded} crash ${s.crash?.outcome ?? '-'} slope ${s.slope.toFixed(2)}`);
    // the start line reads forward riding down, so going up crosses it from its a-to-b left side
    const goingUp = (C.start.b.x - C.start.a.x) * (p[1] - C.start.a.y) - (C.start.b.y - C.start.a.y) * (p[0] - C.start.a.x) > 0;
    if (cross(p, q, C.start) && goingUp) { started = true; s.dabs = 0; t = 0; }
    if (started) t += 1 / 60;
    if (ev.burnt) burnt++;
    minE = Math.min(minE, s.energy);
    if (ev.dab) log.push(`${ev.dab}@${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)}`);
    if (ev.spinout) spin += 1 / 60;
    if (s.crash && !log.at(-1)?.startsWith('CRASH')) log.push(`CRASH-${s.crash.outcome}@${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)}`);
    if (started && climb && s.grounded) minV = Math.min(minV, s.speed);
    if ((sty as any).cheat && climb) {
      const n = up.path.nearest(s.pos.x, s.pos.z);
      if (Math.abs(n.off) > 1.6 && !onHairpin(n.u, 7)) offTrail = (offTrail ?? 0) + 1 / 60;
    }
    if (started && cross(p, q, C.top)) done = `top in ${t.toFixed(1)} s, ${s.dabs} feet down`;
  }
  if (offTrail !== undefined) log.unshift(`OFF THE TRAIL ${offTrail.toFixed(1)} s`);
  console.log(`${sty.name.padEnd(36)} ${done || `stuck at ${s.pos.x.toFixed(1)},${s.pos.z.toFixed(1)} y ${s.pos.y.toFixed(2)}`}  burnt ${burnt} minE ${minE.toFixed(2)}  spin ${spin.toFixed(1)} s  slowest ${minV.toFixed(2)}  ${process.env.TAIL ? log.slice(-14).join(" ") : log.slice(0, 8).join(" ")}`);
}
