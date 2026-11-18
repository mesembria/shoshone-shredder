import { describe, it, expect } from 'vitest';
import { wobbleOver, steerGain, bumpKick, stepWobble } from '../src/lab/wobble';
import { DEFAULTS } from '../src/lab/tune';
import { BIKE_RIDE } from '../src/lab/bikes';

const DT = 1 / 60;
const tFor = (id: 'dirtjumper' | 'bolinas' | 'enduro') => ({ ...DEFAULTS, ...BIKE_RIDE[id] });

describe('speed wobble', () => {
  it("no wobble below the bike's wobble speed, or when it is off", () => {
    const t = tFor('dirtjumper');
    expect(wobbleOver(t.wobbleSpeed - 0.5, t)).toBe(0);
    expect(wobbleOver(t.wobbleSpeed, t)).toBe(0);
    expect(wobbleOver(t.wobbleSpeed + 1, t)).toBeGreaterThan(0);
    expect(wobbleOver(t.maxSpeed, t)).toBeCloseTo(1);
    expect(wobbleOver(30, { ...t, wobbleSpeed: 0 })).toBe(0);
  });

  it('steering gets touchier, not calmer, above it', () => {
    const t = tFor('dirtjumper');
    expect(steerGain(0, t)).toBe(1);
    expect(steerGain(0.5, t)).toBeGreaterThan(1);
  });

  it('bumps kick harder the faster you go and the bigger the kick setting', () => {
    const dj = tFor('dirtjumper'), en = tFor('enduro'), phase = 1.1;
    expect(Math.abs(bumpKick(0.8, 1, phase, dj))).toBeGreaterThan(Math.abs(bumpKick(0.3, 1, phase, dj)));
    expect(Math.abs(bumpKick(0.5, 1, phase, dj))).toBeGreaterThan(Math.abs(bumpKick(0.5, 1, phase, en)));
    expect(bumpKick(0, 1, phase, dj)).toBe(0);
  });

  it('swinging hard above the line builds to the limit in about a second', () => {
    const t = tFor('dirtjumper');
    let level = 0, n = 0;
    while (level < t.wobbleLimit && n < 600) {
      level = stepWobble(level, { over: 0.5, yawJerk: n % 36 < 18 ? 6 : -6, braking: false, steady: false }, DT, t);
      n++;
    }
    expect(n * DT).toBeGreaterThan(0.6);
    expect(n * DT).toBeLessThan(1.6);
  });

  it('braking drains it fast; a still thumb drains it slowly', () => {
    const t = tFor('dirtjumper');
    const after = (braking: boolean, steady: boolean) => {
      let level = 0.8;
      for (let i = 0; i < 30; i++) level = stepWobble(level, { over: 0.4, yawJerk: 0, braking, steady }, DT, t);
      return level;
    };
    expect(after(true, false)).toBeLessThan(after(false, true));
    expect(after(false, true)).toBeLessThan(0.8);
    expect(after(false, false)).toBe(0.8);
  });
});
