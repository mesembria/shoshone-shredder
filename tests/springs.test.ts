import { describe, it, expect } from 'vitest';
import { createSpring, landKick, stepSpring, resetSpring, type Spring } from '../src/bike/springs';
import type { SpringKind } from '../src/rules/bikes';

const T = { suspStiff: 160, suspDamp: 14 };
// steps a kicked spring for `secs` at 60 fps, returning its peak and where it ends
function ride(used: number, kind: SpringKind, secs = 2, dt = 1 / 60): { peak: number; end: number; sp: Spring } {
  const sp = createSpring();
  sp.v += landKick(used, kind, T);
  let peak = 0;
  for (let t = 0; t < secs; t += dt) {
    stepSpring(sp, dt, 0, kind, T);
    peak = Math.max(peak, sp.x);
  }
  return { peak, end: sp.x, sp };
}

describe('suspension springs (look only)', () => {
  it('a landing kick peaks near the travel used and settles back to rest', () => {
    for (const kind of ['air', 'coil'] as const) {
      const { peak, end } = ride(0.5, kind);
      expect(peak, kind).toBeGreaterThan(0.35);
      expect(peak, kind).toBeLessThan(0.65);
      expect(Math.abs(end), kind).toBeLessThan(0.02);
    }
  });

  it('using all the travel reaches the bump stop and never passes it', () => {
    for (const used of [1, 1.6, 3]) {
      const { peak } = ride(used, 'air');
      expect(peak).toBeGreaterThanOrEqual(0.95);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });

  it('coil sinks deeper than air for the same kick', () => {
    const v = landKick(0.7, 'coil', T);
    const peakOf = (kind: SpringKind) => {
      const sp = createSpring();
      sp.v = v;
      let peak = 0;
      for (let i = 0; i < 120; i++) { stepSpring(sp, 1 / 60, 0, kind, T); peak = Math.max(peak, sp.x); }
      return peak;
    };
    expect(peakOf('coil')).toBeGreaterThan(peakOf('air'));
  });

  it('a slow frame stays sane', () => {
    const sp = createSpring();
    sp.v = landKick(3, 'coil', T) * 4;
    stepSpring(sp, 0.25, 0, 'coil', T);
    expect(Number.isFinite(sp.x)).toBe(true);
    expect(sp.x).toBeGreaterThanOrEqual(-0.3);
    expect(sp.x).toBeLessThanOrEqual(1);
  });

  it('settles at its rest offset, stretched or sunk', () => {
    const sp = createSpring();
    for (let i = 0; i < 180; i++) stepSpring(sp, 1 / 60, -0.3, 'air', T);
    expect(sp.x).toBeCloseTo(-0.3, 2);
    for (let i = 0; i < 180; i++) stepSpring(sp, 1 / 60, 0.25, 'air', T);
    expect(sp.x).toBeCloseTo(0.25, 1);
  });

  it('deepest remembers the biggest hit until reset', () => {
    const { sp, peak } = ride(0.6, 'air');
    expect(sp.deepest).toBeGreaterThanOrEqual(peak); // it sees every slice, not just each frame
    expect(sp.deepest - peak).toBeLessThan(0.01);
    resetSpring(sp);
    expect(sp).toEqual(createSpring());
  });
});
