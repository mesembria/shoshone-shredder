import { describe, it, expect } from 'vitest';
import { PARTS } from '../src/game/catalog';
import { specOf } from '../src/game/hub/ui';

describe('part spec text', () => {
  it('drops a name the spec line repeats, and only then', () => {
    expect(specOf('Air fork', 'Air fork · 120 mm')).toBe('120 mm');
    expect(specOf('Sticky tires', 'Sticky rubber · 2.4 in')).toBe('Sticky rubber · 2.4 in');
  });
  it('never leaves a part with an empty spec', () => {
    for (const p of PARTS) expect(specOf(p.name, p.spec).length).toBeGreaterThan(0);
  });
});
