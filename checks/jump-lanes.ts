// Robot down each jump lane through the game's challenge code: rolled, popped, cruising and sprinting.
// Rides the lanes on Mesa Jump Park.
const P = new URL('../src', import.meta.url).pathname;
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { createPhysics } = await import(`${P}/world/physics.ts`);
const { LAB_BIKES } = await import(`${P}/lab/bikes.ts`);
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
const { CHALLENGES, startRun, tick, trickTick } = await import(`${P}/game/challenges.ts`);
const { inZone } = await import(`${P}/world/trail.ts`);
const course = buildPlace('mesaJumpPark');
console.log(`bike: ${LAB_BIKES[bike].name}`);
const phys = await createPhysics(course.world);
for (const id of ['tableSmall', 'tableMedium', 'tableBig']) {
  const def = CHALLENGES.find((c) => c.id === id)!;
  const st = course.stations[def.spot];
  for (const throttle of [0, 1]) for (const pop of [false, true]) {
    Object.assign(T, DEFAULTS);
    applyLoadout(L);
    const s = createLabState(L.spec, st.pos.clone(), st.yaw);
    placeBike(s, st.pos.clone(), st.yaw);
    const run = startRun(def);
    let out = 'no result', fromLip = false, airs: string[] = [], held = 0, burnt = 0;
    for (let i = 0; i < 60 * 40; i++) {
      // hold Jump on the way up a takeoff and let go at the lip, the way a kid pops
      let hop: number | null = null;
      if (pop) { if (s.grounded && s.slope > 0.15) held += 1 / 60; else if (held > 0) { hop = held; held = 0; } }
      const ev = stepLab(s, { steer: Math.max(-1, Math.min(1, (s.pos.z - st.pos.z) * 0.5 + (s.yaw) * 2)), throttle, hop, swipe: null, again: false, crouch: pop && held > 0 }, 1 / 60, phys, course.lines);
      if (ev.burnt) burnt++;
      if (!s.grounded && s.air) fromLip = s.air.line !== null;
      if (ev.landed) airs.push(`${ev.landed}${fromLip ? "" : "(flat)"} ${ev.airTime?.toFixed(2)}s${process.env.DEBUG ? " i" + ev.impact?.toFixed(1) : ""}`);
      const r = tick(run, { dt: 1 / 60, ...trickTick(ev.banked, s.combo), landed: ev.landed ?? undefined, airTime: ev.airTime, fromLip: ev.landed ? fromLip : undefined, left: !inZone(course.zones[def.spot], s.pos.x, s.pos.z) });
      if (r.state !== 'running') { out = r.state === 'done' ? `done ${r.stars}★` : r.why; break; }
    }
    console.log(`${id.padEnd(12)} stick ${throttle} ${pop ? 'pop ' : 'roll'}: ${out.padEnd(18)} burnt ${burnt}  landings: ${airs.join(', ')}`);
  }
}
