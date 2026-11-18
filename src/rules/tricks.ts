import type { SwipeDir } from './gestures';

export type TrickId = 'bunnyhop' | 'manual' | 'tabletop' | 'nohander';

// seconds: how long the trick takes in the air (0 for ground tricks). Manual points are per second held.
export const TRICK_INFO: Record<TrickId, { name: string; seconds: number; points: number }> = {
  bunnyhop: { name: 'Bunny hop', seconds: 0, points: 50 },
  manual: { name: 'Manual', seconds: 0, points: 60 },
  tabletop: { name: 'Tabletop', seconds: 0.45, points: 150 },
  nohander: { name: 'No-hander', seconds: 0.4, points: 200 },
};

export function trickForSwipe(dir: SwipeDir, grounded: boolean): TrickId | null {
  if (grounded) return dir === 'down' ? 'manual' : null;
  if (dir === 'up') return 'nohander';
  if (dir === 'left' || dir === 'right') return 'tabletop';
  return null;
}

export interface Combo { points: number; count: number }
export const EMPTY_COMBO: Combo = { points: 0, count: 0 };

export function addToCombo(c: Combo, points: number): Combo {
  return { points: c.points + points, count: c.count + 1 };
}

export function comboTotal(c: Combo): number {
  return c.points * Math.max(1, c.count);
}
