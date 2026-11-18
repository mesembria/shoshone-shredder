// Robot slalom through the game's challenge code, cruising and sprinting. Slaloms on Mesa Jump Park.
const P = new URL('../src', import.meta.url).pathname;
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { createPhysics } = await import(`${P}/world/physics.ts`);
const { loadout, applyLoadout, PARTS: CATALOG } = await import(`${P}/game/catalog.ts`);
// PARTS=stock (the default), all (every upgrade; the first where a slot has two) or a list of part ids
const loadoutFor = (b: string) => {
  const want = process.env.PARTS ?? 'stock', ups = CATALOG.filter((x: any) => x.bike === b && !x.stock);
  const pick = want === 'stock' ? [] : want === 'all' ? ups.filter((x: any, i: number) => ups.findIndex((y: any) => y.slot === x.slot) === i) : ups.filter((x: any) => want.split(',').includes(x.id));
  return loadout(b, Object.fromEntries(pick.map((x: any) => [x.slot, x.id])));
};
const L = loadoutFor(process.env.BIKE ?? 'bolinas'); // BIKE=hardtail, dirtjumper or enduro rides another lab bike
const { T, DEFAULTS } = await import(`${P}/lab/tune.ts`);
const { CHALLENGES, startRun, tick } = await import(`${P}/game/challenges.ts`);
const course = buildPlace('mesaJumpPark');
const phys = await createPhysics(course.world);
const st = course.stations.Slalom;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const cross = (p: number[], q: number[], a: { x: number; y: number }, b: { x: number; y: number }) => {
  const side = (o: number[], u: number[], v: number[]) => Math.sign((u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]));
  return side(p, q, [a.x, a.y]) !== side(p, q, [b.x, b.y]) && side([a.x, a.y], [b.x, b.y], p) !== side([a.x, a.y], [b.x, b.y], q);
};
const def = CHALLENGES.find((c) => c.id === 'coneZone')!;
for (const throttle of [0, 0.2, 0.35, 0.5]) for (const gain of [4, 6, 9]) for (const off of [0, 0.8, 1.5]) {
  Object.assign(T, DEFAULTS);
  applyLoadout(L);
  const s = createLabState(L.spec, st.pos.clone(), st.yaw);
  placeBike(s, st.pos.clone(), st.yaw);
  const run = startRun(def);
  let out = 'no result', next = 0;
  for (let i = 0; i < 60 * 25; i++) {
    const g = course.gates[Math.min(next, course.gates.length - 1)];
    const tx = (g.a.x + g.b.x) / 2 + off, tz = (g.a.y + g.b.y) / 2;
    const err = wrap(Math.atan2(-(tz - s.pos.z), tx - s.pos.x) - s.yaw);
    const p = [s.pos.x, s.pos.z];
    const ev = stepLab(s, { steer: Math.max(-1, Math.min(1, -err * gain)), throttle, hop: null, swipe: null, again: false, crouch: false }, 1 / 60, phys, course.lines);
    let r = tick(run, { dt: 1 / 60, landed: ev.landed ?? (s.crash ? 'wipeout' : undefined) });
    course.gates.forEach((gt, k) => { if (cross(p, [s.pos.x, s.pos.z], gt.a, gt.b)) { r = tick(run, { dt: 0, gate: k }); if (k === next) next++; } });
    if (r.state !== 'running') { out = JSON.stringify(r) + ` at ${run.t.toFixed(1)} s`; break; }
    if (s.crash) { out = 'crashed'; break; }
  }
  if (out.includes("done")) console.log(`stick ${throttle} gain ${gain} aim +${off}: ${out}  (gates ${run.count}/${course.gates.length})`);
}
