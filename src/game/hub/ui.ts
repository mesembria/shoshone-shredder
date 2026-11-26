// Bits the Garage and the Shop share: escaping, the 0..10 stat bar, slot names, and the one way a rider's save changes.
import type { Slot } from '../catalog';
import { STAT_GROUPS, STAT_NAMES, type Stat } from '../stats';
import { loadGame, saveGame, type Profile, type Store } from '../progress';

export const SLOT_NAMES: Record<Slot, string> = { suspension: 'Suspension', tires: 'Tires', brakes: 'Brakes', cockpit: 'Cockpit', drivetrain: 'Drivetrain' };
export const STATS = STAT_GROUPS.flatMap((g) => g.stats);
export { esc } from '../esc';
export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const num = (n: number, d = 1) => String(+n.toFixed(d));

// One 0..10 bar; with a different `next`, the gain shows green and the loss red-striped
export function bar(s: Stat, now: number, next = now, kind = ''): string {
  const lo = Math.min(now, next), hi = Math.max(now, next), d = Math.round((next - now) * 10) / 10;
  const k = d > 0 ? 'gain' : d < 0 ? 'loss' : kind;
  return `<div class="stat ${k}" data-stat="${s}" data-v="${next}">
    <span class="sn">${STAT_NAMES[s]}</span>
    <span class="track"><i class="fill" style="width:${lo * 10}%"></i>${d ? `<i class="${d > 0 ? 'up' : 'down'}" style="left:${lo * 10}%;width:${(hi - lo) * 10}%"></i>` : ''}</span>
    <span class="sv">${d ? (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1) : next.toFixed(1)}</span>
  </div>`;
}

// Re-read the store, change only this rider, save. False when the move isn't allowed (a second tap on Buy): nothing
// is written. Never write a game held since page load: another page may have saved since.
export function writeRider(store: Store, index: number, fn: (p: Profile) => Profile | null): boolean {
  const g = loadGame(store);
  const p = fn(g.riders[index]);
  if (!p) return false;
  g.riders[index] = p;
  saveGame(store, g);
  return true;
}
