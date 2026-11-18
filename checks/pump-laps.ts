// Robot laps of the pump track fed through the game's own challenge code: does a lap register, and how many stars?
// Laps the pump track on Mesa Jump Park.
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
const { lapEvent } = await import(`${P}/game/spots.ts`);
const { inZone } = await import(`${P}/world/trail.ts`);
const course = buildPlace('mesaJumpPark');
const phys = await createPhysics(course.world);
const st = course.stations['Pump track'];
const PT = course.pumpTrack!, pts: [number, number][] = [];
for (let x = PT.x - PT.half; x < PT.x + PT.half; x += 0.25) pts.push([x, PT.z - PT.R]);
for (let a = 0; a < Math.PI; a += 0.25 / PT.R) pts.push([PT.x + PT.half + PT.R * Math.sin(a), PT.z - PT.R * Math.cos(a)]);
for (let x = PT.x + PT.half; x > PT.x - PT.half; x -= 0.25) pts.push([x, PT.z + PT.R]);
for (let a = 0; a < Math.PI; a += 0.25 / PT.R) pts.push([PT.x - PT.half - PT.R * Math.sin(a), PT.z + PT.R * Math.cos(a)]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const def = CHALLENGES.find((c) => c.id === 'pumpHouse')!;
for (const pump of ['none', 'hold', 'timed'] as const) {
  Object.assign(T, DEFAULTS);
  applyLoadout(L);
  const s = createLabState(L.spec, st.pos.clone(), st.yaw);
  placeBike(s, st.pos.clone(), st.yaw);
  s.speed = st.speed!;
  const run = startRun(def);
  let prev = { x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: true }, out = 'no result', events: string[] = [];
  for (let i = 0; i < 60 * 60; i++) {
    let best = 0, bd = 1e9;
    for (let k = 0; k < pts.length; k++) { const d = (pts[k][0] - s.pos.x) ** 2 + (pts[k][1] - s.pos.z) ** 2; if (d < bd) { bd = d; best = k; } }
    const tgt = pts[(best + 14) % pts.length];
    const err = wrap(Math.atan2(-(tgt[1] - s.pos.z), tgt[0] - s.pos.x) - s.yaw);
    const crouch = pump === 'hold' ? true : pump === 'timed' ? s.grounded && s.slope < -0.02 : false;
    const ev = stepLab(s, { steer: Math.max(-1, Math.min(1, -err * 3)), throttle: 0, hop: null, swipe: null, again: false, crouch, coast: true }, 1 / 60, phys, course.lines);
    const w = { x: s.pos.x, y: s.pos.y, z: s.pos.z, grounded: s.grounded };
    const lap = lapEvent(prev, w, PT) ?? undefined;
    if (lap) events.push(`${lap}@${run.t.toFixed(1)}`);
    prev = w;
    const r = tick(run, { dt: 1 / 60, landed: ev.landed, airTime: ev.airTime, lap, left: !inZone(course.zones['Pump track'], w.x, w.z) });
    if (r.state !== 'running') { out = JSON.stringify(r) + ` at ${run.t.toFixed(1)} s`; break; }
  }
  console.log(`pump ${pump.padEnd(6)} ${out}   lap line: ${[...new Set(events)].slice(0, 8).join(' ')}`);
}
