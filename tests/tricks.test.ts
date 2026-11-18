import { describe, it, expect } from 'vitest';
import { trickForSwipe, addToCombo, comboTotal, EMPTY_COMBO } from '../src/rules/tricks';

describe('trickForSwipe', () => {
  it('swipe down on the ground starts a manual', () => expect(trickForSwipe('down', true)).toBe('manual'));
  it('swipe up in the air is a no-hander', () => expect(trickForSwipe('up', false)).toBe('nohander'));
  it('swipe sideways in the air is a tabletop', () => {
    expect(trickForSwipe('left', false)).toBe('tabletop');
    expect(trickForSwipe('right', false)).toBe('tabletop');
  });
  it('swipe up on the ground does nothing', () => expect(trickForSwipe('up', true)).toBeNull());
});

describe('combos', () => {
  it('multiplies points by the number of tricks', () => {
    const c = [150, 200, 50].reduce((acc, p) => addToCombo(acc, p), EMPTY_COMBO);
    expect(c).toEqual({ points: 400, count: 3 });
    expect(comboTotal(c)).toBe(1200);
  });
  it('an empty combo is worth nothing', () => expect(comboTotal(EMPTY_COMBO)).toBe(0));
});
