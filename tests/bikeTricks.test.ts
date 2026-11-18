import { describe, it, expect } from 'vitest';
import * as tricks from '../src/game/bikeTricks';
import { airTrickFor } from '../src/game/bikeTricks';

describe('air tricks', () => {
  it('maps swipes to tricks', () => {
    expect(airTrickFor('up')).toBe('nohander');
    expect(airTrickFor('down')).toBe('flip');
    expect(airTrickFor('left')).toBe('spin');
    expect(airTrickFor('right')).toBe('spin');
  });

  it('no longer ties tricks to bikes', () => {
    expect('BIKE_TRICKS' in tricks).toBe(false);
    expect('whoCan' in tricks).toBe(false);
  });
});
