import { describe, it, expect } from 'vitest';
import { airHints } from '../src/game/unlocks';

describe('airHints', () => {
  it('lists every air trick on every bike', () => {
    expect(airHints()).toEqual({ above: 'swipe ↑ No-hander', below: '↓ Backflip · ←→ 360\nhold: Tabletop' });
  });
});
