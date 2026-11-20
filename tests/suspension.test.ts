import { describe, it, expect } from 'vitest';
import { landingCapacity, bottomTier } from '../src/rules/suspension';
import { kitOf, withKit } from '../src/rules/bikes';
import { LAB_BIKES } from '../src/lab/bikes';
import { DEFAULTS } from '../src/lab/tune';

describe('bottoming out', () => {
  it('the rigid hardtail takes exactly 6, today\'s heavy-landing number', () => {
    expect(landingCapacity(kitOf(LAB_BIKES.hardtail), DEFAULTS)).toBe(6);
  });

  it('travel adds, averaged front and rear', () => {
    const k = withKit(kitOf(LAB_BIKES.hardtail), { fork: { kind: 'air', travel: 130 } });
    expect(landingCapacity(k, DEFAULTS)).toBeCloseTo(DEFAULTS.bottomBase + (DEFAULTS.bottomPerMm * 130 * DEFAULTS.airFactor) / 2, 9);
    const en = kitOf(LAB_BIKES.enduro);
    expect(landingCapacity(en, DEFAULTS)).toBeCloseTo(DEFAULTS.bottomBase + (DEFAULTS.bottomPerMm * (170 + 170) * DEFAULTS.airFactor) / 2, 9);
  });

  it('air resists bottoming more than coil', () => {
    const en = kitOf(LAB_BIKES.enduro);
    expect(landingCapacity(en, DEFAULTS)).toBeGreaterThan(landingCapacity(withKit(en, { rear: { shock: 'coil' } }), DEFAULTS));
  });

  it('tiers', () => {
    expect(bottomTier(1, 0.5)).toBe('within');
    expect(bottomTier(1.01, 0.5)).toBe('bottomed');
    expect(bottomTier(1.5, 0.5)).toBe('bottomed');
    expect(bottomTier(1.51, 0.5)).toBe('slammed');
  });
});
