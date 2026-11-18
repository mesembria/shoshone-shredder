import { describe, it, expect } from 'vitest';
import { hopSpeed } from '../src/rules/hop';

describe('hopSpeed', () => {
  it('a tap gives a bunny hop', () => expect(hopSpeed(0, null)).toBeCloseTo(4.2));
  it('holding 0.6 seconds gives a full pop', () => expect(hopSpeed(0.6, null)).toBeCloseTo(6.0));
  it('holding halfway gives half the extra pop', () => expect(hopSpeed(0.27, null)).toBeCloseTo(5.1));
  it('popping right at a lip adds 25 percent', () => expect(hopSpeed(0, 0.1)).toBeCloseTo(5.25));
  it('popping late at a lip adds nothing', () => expect(hopSpeed(0, 0.2)).toBeCloseTo(4.2));
});
