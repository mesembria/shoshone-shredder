// Repro: ride Hairpin Hollow DOWN into a switchback too fast, crash into the ring of clumps round its outside, tumble the
// way the game does (src/lab/ride.ts step), get up where the tumble left you, then try to get back onto the trail.
const P = new URL('../src', import.meta.url).pathname;
const THREE = await import('three');
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { trailPoint } = await import(`${P}/world/trail.ts`);
const { createLabState, placeBike, stepLab } = await import(`${P}/lab/bike.ts`);
const { forward } = await import(`${P}/bike/controller.ts`);
const { createPhysics, castDown, spawnTumble, removeTumble, bodyFits } = await import(`${P}/world/physics.ts`);
const { LAB_BIKES } = await import(`${P}/lab/bikes.ts`);
const { hairpin } = await import(`${P}/world/trails/hairpin.ts`);
const course = buildPlace('shredderHills');
const phys = await createPhysics(course.world);
const t = course.trails.hairpin, marks = hairpin().marks;
const sbs = (process.env.SB ?? '3').split(',').map(Number);
const dist = (a: any, u: number) => { let best = Infinity, bu = 0; for (let k = 0; k <= t.path.length; k += 0.1) { const p = t.path.at(k), d = Math.hypot(p.x - a.x, p.z - a.z); if (d < best) { best = d; bu = k; } } return { off: best, u: bu }; };
const clumps = (course as any).bumpers.spots;
const near = (a: any) => { let b = Infinity, r = 0; for (const c of clumps) { const d = Math.hypot(c.x - a.x, c.z - a.z) - c.r; if (d < b) { b = d; r = c.r; } } return `${b.toFixed(2)} m out from its edge (r ${r})`; };
console.log('clumps', clumps.length);
for (const sb of sbs) for (const speed of [6, 8, 10, 12]) for (const aim of [-0.4, 0, 0.4]) {
  // start 8 m before the switchback's end (riding down, the switchback starts at marks.switchbacks[sb] + turn and we
  // meet it from the leg after it), heading down the trail, then ride straight on at speed (no steering)
  const uEnd = marks.switchbacks[sb] + Math.PI * 2; // where the turn ends ridden up = where it starts ridden down
  const u0 = uEnd + 8, p0 = trailPoint(t, u0, aim);
  const s: any = createLabState({ ...LAB_BIKES.bolinas }, new THREE.Vector3(p0.x, p0.y + 0.05, p0.z), t.path.at(u0).yaw + Math.PI);
  placeBike(s, new THREE.Vector3(p0.x, p0.y + 0.05, p0.z), t.path.at(u0).yaw + Math.PI);
  s.speed = speed;
  let tumble: any = null, crashed = false, gotUp: any = null;
  const vel = new THREE.Vector3();
  for (let i = 0; i < 60 * 8; i++) {
    const intent = { steer: 0, throttle: crashed ? 0 : 1, hop: false, swipe: null, again: false, crouch: false };
    stepLab(s, intent, 1 / 60, phys, course.lines);
    if (s.crash && !tumble) { crashed = true; forward(s, vel).multiplyScalar(s.speed); vel.y = Math.max(0, s.vy); tumble = spawnTumble(phys, s.pos, vel, s.crash.outcome === 'big' ? 9 : 6); }
    if (tumble && !s.crash) { removeTumble(phys, tumble); tumble = null; gotUp = s.pos.clone(); break; }
    if (tumble) { phys.world.step(); const b = tumble.bike.translation(); const below = castDown(phys, b.x, b.y + 1, b.z, 40); if (below) s.pos.set(b.x, below.height, b.z); }
    if (!crashed && dist(s.pos, 0).u < marks.switchbacks[sb] - 3) break; // made it round
  }
  if (!gotUp) { console.log(`sb${sb} v${speed} aim${aim}: ${crashed ? 'crash, no get-up' : 'no crash'}`); continue; }
  const d = dist(gotUp, 0), fits = bodyFits(phys, gotUp, s.yaw);
  // escape: from where you got up, set off each of 8 ways, following the trail on down, 6 s at full pedal; how far the
  // bike gets (stuck overlapping a clump, it never gets past about 0.6 m)
  const target = t.path.at(Math.max(0, d.u - 8));
  let moved = 0;
  for (const tryYaw of [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4)) {
    const e: any = createLabState({ ...LAB_BIKES.bolinas }, gotUp.clone(), tryYaw);
    e.pos.copy(gotUp); e.yaw = tryYaw; e.respawn = { pos: gotUp.clone(), yaw: tryYaw };
    let cu = d.u;
    for (let i = 0; i < 60 * 6; i++) {
      // follow the trail on down: the nearest u near the last one, then aim 2 m further down
      let bd = Infinity;
      for (let k = Math.max(0, cu - 3); k <= cu + 1; k += 0.1) { const q = t.path.at(k), dd = Math.hypot(q.x - e.pos.x, q.z - e.pos.z); if (dd < bd) { bd = dd; cu = k; } }
      const aimP = t.path.at(Math.max(0, cu - 2));
      const want = Math.atan2(-(aimP.z - e.pos.z), aimP.x - e.pos.x), dd = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw));
      stepLab(e, { steer: Math.max(-1, Math.min(1, dd * 2)), throttle: 1, hop: null, swipe: null, again: false, crouch: false }, 1 / 60, phys, course.lines);
    }
    moved = Math.max(moved, e.pos.distanceTo(gotUp));
  }
  console.log(`sb${sb} v${speed} aim${aim}: crash -> got up ${d.off.toFixed(2)} m off centre (half width ${t.width / 2}) at u ${d.u.toFixed(1)}, body fits: ${fits}, moves at most ${moved.toFixed(2)} m; nearest clump ${near(gotUp)}`);
}
