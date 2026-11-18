import { describe, it, expect } from 'vitest';
import { comboLine, calloutFor } from '../src/view/hud';

describe('hud text', () => {
  it('shows the combo with its multiplier', () => {
    expect(comboLine([], { points: 0, count: 0 })).toBe('');
    expect(comboLine(['Bunny hop'], { points: 50, count: 1 })).toBe('Bunny hop  50');
    expect(comboLine(['Bunny hop', 'Tabletop'], { points: 200, count: 2 })).toBe('Bunny hop + Tabletop  200 ×2 = 400');
    expect(comboLine(['Backflip', '360'], { points: 700, count: 2 })).toBe('Backflip + 360  700 ×2 = 1400');
  });

  it('names each landing, and big crashes name their penalties', () => {
    expect(calloutFor('clean').tone).toBe('good');
    expect(calloutFor('wipeout').text).toBe('Wipeout!');
    expect(calloutFor('big').sub).toBe('Seeing stars · Winded');
  });
});
