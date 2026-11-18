import { describe, it, expect } from 'vitest';
import { takesOverStick } from '../src/input/controls';

// A new left touch replaces the held thumb only if it lands on the stick: a thumb coming back after iPadOS lost
// its lift. A palm or the base of the thumb brushing the corner while steering must not grab the stick.
describe('takesOverStick', () => {
  const stickAt = { x: 130, y: 508 }, range = 70;
  it('lets a touch on or near the stick take over', () => {
    expect(takesOverStick(stickAt, { x: 130, y: 508 }, range)).toBe(true);
    expect(takesOverStick(stickAt, { x: 200, y: 560 }, range)).toBe(true);
  });
  it('ignores a palm in the bottom-left corner', () => {
    expect(takesOverStick(stickAt, { x: 30, y: 790 }, range)).toBe(false);
  });
  it('ignores a touch well away from the stick', () => {
    expect(takesOverStick(stickAt, { x: 400, y: 300 }, range)).toBe(false);
  });
});
