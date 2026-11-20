// What the bottoming rule would change, worked out from a LANDLOG run without riding again. For each logged landing it
// compares today's heavy-landing rule (impact > 6 on flat ground loses flatKeep) with the new one (src/rules/
// suspension.ts): a bottom-out where there was none, none where there was one (travel helping), or a slam (bobble).
// It lists the changes on rides that set a challenge's best result for a bike and part mix, where they could move the ladder.
// Usage: npx vite-node checks/landing-whatif.ts <dir>   with Tune overrides as env, e.g. BOTTOMMARGIN=0.7 PERMM=0.02
// FLATGATE=1 keeps the flat-ground gate on the speed loss.
import { readLog, type LoggedRide } from './landing-data.ts';
const P = new URL('../src', import.meta.url).pathname;
const { landingCapacity, bottomTier } = await import(`${P}/rules/suspension.ts`);
const { DEFAULTS } = await import(`${P}/lab/tune.ts`);
const { DEFAULT_KIT } = await import(`${P}/rules/bikes.ts`);

const t = { ...DEFAULTS };
const env = (k: string) => (process.env[k] !== undefined ? Number(process.env[k]) : undefined);
t.bottomMargin = env('BOTTOMMARGIN') ?? t.bottomMargin;
t.bottomPerMm = env('PERMM') ?? t.bottomPerMm;
t.bottomBase = env('BASE') ?? t.bottomBase;
const flatGate = process.env.FLATGATE === '1';

const rides = readLog(process.argv[2]);
const pts = (id: string) => ['tableSmall', 'tableMedium', 'tableBig', 'tableXL', 'whoop', 'plank'].includes(id);
const better = (a: LoggedRide, b: LoggedRide) => (b.stars !== a.stars ? b.stars > a.stars : pts(a.challenge) ? b.points > a.points : b.t < a.t);
const best = new Map<string, LoggedRide>();
for (const r of rides) {
  if (!r.ok) continue;
  const k = `${r.challenge} ${r.bike} ${r.fit}`;
  if (!best.has(k) || better(best.get(k)!, r)) best.set(k, r);
}

let changed = 0;
const lines: string[] = [];
for (const r of rides) {
  const cap = landingCapacity((r.kit as never) ?? DEFAULT_KIT, t);
  for (const l of r.landings) {
    const oldHeavy = l.impact > 6 && Math.abs(l.slope) < 0.1;
    const used = l.impact / cap, tier = bottomTier(used, t.bottomMargin);
    const newLoss = tier !== 'within' && (!flatGate || Math.abs(l.slope) < 0.1);
    const slam = tier === 'slammed' && l.outcome === 'clean';
    if (oldHeavy === newLoss && !slam) continue;
    changed++;
    if (best.get(`${r.challenge} ${r.bike} ${r.fit}`) === r)
      lines.push(`${r.challenge.padEnd(12)} ${r.bike.padEnd(10)} ${r.fit.padEnd(28)} ${r.stars}★ impact ${l.impact.toFixed(2)} slope ${l.slope.toFixed(2)} used ${used.toFixed(2)}: ${slam ? 'SLAM (bobble)' : newLoss ? 'now bottoms out' : 'no longer loses speed'}`);
  }
}
console.log(`base ${t.bottomBase} perMm ${t.bottomPerMm} margin ${t.bottomMargin}${flatGate ? ' (flat gate)' : ''}: ${changed} landings change across ${rides.length} rides`);
console.log(lines.length ? `on a best ride:\n${lines.join('\n')}` : 'none on a best ride');
