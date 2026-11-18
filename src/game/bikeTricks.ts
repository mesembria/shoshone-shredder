// The air tricks and which swipe does each. Any bike can try any of them; whether it lands depends on the bike's pop
// and spin (see src/lab/bike.ts).
import type { SwipeDir } from '../rules/gestures';

export type AirTrick = 'nohander' | 'spin' | 'flip';

export const TRICK_NAMES: Record<AirTrick, string> = { nohander: 'No-hander', spin: '360', flip: 'Backflip' };

export function airTrickFor(swipe: SwipeDir): AirTrick {
  return swipe === 'up' ? 'nohander' : swipe === 'down' ? 'flip' : 'spin';
}
