// Summarises a LANDLOG directory from checks/ladder-robots.ts: per challenge and bike, the hardest landing (impact,
// m/s into the slope) of any ride, of rides that earned a star and of rides that earned 2★, then the hardest hardtail
// landing on any star-earning ride. Usage: npx vite-node checks/landing-log.ts <dir>
import { readLog, type LoggedRide } from './landing-data.ts';

const hardest = (rides: LoggedRide[]) => Math.max(0, ...rides.flatMap((r) => r.landings.map((l) => l.impact)));

{
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: npx vite-node checks/landing-log.ts <dir>');
  const rides = readLog(dir);
  const keys = [...new Set(rides.map((r) => `${r.challenge} ${r.bike}`))].sort();
  console.log(`${rides.length} rides, ${rides.reduce((n, r) => n + r.landings.length, 0)} landings`);
  console.log('challenge bike            any    ≥1★    ≥2★');
  for (const k of keys) {
    const mine = rides.filter((r) => `${r.challenge} ${r.bike}` === k);
    const col = (min: number) => hardest(mine.filter((r) => r.ok && r.stars >= min)).toFixed(2).padStart(6);
    console.log(`${k.padEnd(24)} ${hardest(mine).toFixed(2).padStart(6)} ${col(1)} ${col(2)}`);
  }
  const ht = rides.filter((r) => r.bike === 'hardtail' && r.ok && r.stars >= 1);
  console.log(`\nhardtail, hardest landing on a star-earning ride: ${hardest(ht).toFixed(2)} m/s`);
}
