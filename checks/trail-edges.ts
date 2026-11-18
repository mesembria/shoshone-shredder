// Walk each trail edge on Shredder Hills looking for a gap in the rocks wide enough for the bike's body (0.6 m) to slip
// through: Goat Ladder's legs and descent, Hairpin Hollow's legs and Boulder Dash, along their curves.
const P = new URL('../src', import.meta.url).pathname;
const { buildPlace } = await import(`${P}/world/places/index.ts`);
const { trailPoint } = await import(`${P}/world/trail.ts`);
const { createPhysics, castDown } = await import(`${P}/world/physics.ts`);
const course = buildPlace('shredderHills');
const phys = await createPhysics(course.world);
{
  // the same walk along a trail from u0 to u1: the trail's height from the dirt across it, the edge just past the rock line
  const walk = (name: string, t: any, u0: number, u1: number) => {
    const found: string[] = [], edge = t.width / 2 + 0.55;
    for (const side of [-1, 1]) {
      let run = 0, at = 0;
      for (let u = u0 + 0.3; u < u1 - 0.3; u += 0.05) {
        let trail = Infinity;
        for (let off = -t.width / 2 + 0.2; off <= t.width / 2 - 0.2; off += 0.2) { const p = trailPoint(t, u, off), g = castDown(phys, p.x, p.y + 20, p.z, 60); if (g && g.surface !== 'rock') trail = Math.min(trail, g.height); }
        const p = trailPoint(t, u, side * edge), h = castDown(phys, p.x, p.y + 20, p.z, 60);
        const open = !h || h.surface !== 'rock' || h.height - trail < 0.3;
        if (open) { if (!run) at = u; run += 0.05; } else { if (run > 0.25) found.push(`${side > 0 ? 'right' : 'left'} ${run.toFixed(2)} m at u ${at.toFixed(1)}`); run = 0; }
      }
      if (run > 0.25) found.push(`${side > 0 ? 'right' : 'left'} ${run.toFixed(2)} m at u ${at.toFixed(1)} (to the end)`);
    }
    console.log(name.padEnd(14), found.length ? found.join(' | ') : 'no gaps');
  };
  const T = course.trails, SR = 3.5, turn = Math.PI * SR;
  const { goatLadder } = await import(`${P}/world/trails/goatLadder.ts`);
  const { hairpin } = await import(`${P}/world/trails/hairpin.ts`);
  const { boulderDash } = await import(`${P}/world/trails/boulderDash.ts`);
  const gm = goatLadder().marks, hm = hairpin().marks, bm = boulderDash().marks;
  const [s1, s2] = gm.switchbacks;
  walk('goat leg 1', T.goatUp, gm.start, s1);
  walk('goat leg 2', T.goatUp, s1 + turn, s2);
  walk('goat leg 3', T.goatUp, s2 + turn, T.goatUp.path.length);
  walk('goat descent', T.goatDown, turn, gm.foot);
  hm.legs.forEach(([a, b]: [number, number], i: number) => walk(`hairpin leg ${i + 1}`, T.hairpin, a, b));
  walk('boulder dash', T.boulderDash, 4, bm.finishU + 6);
}
