import { describe, it, expect } from 'vitest';
import { nextSpeed, turnRate, isSkidding, skidTurnRate } from '../src/rules/ride';
import { BIKES } from '../src/rules/bikes';

const dt = 1 / 60;
const run = (s0: number, steps: number, f: (s: number) => number) => {
  let s = s0;
  for (let i = 0; i < steps; i++) s = f(s);
  return s;
};

describe('nextSpeed', () => {
  it('auto-pedal settles at cruise speed', () => {
    expect(run(0, 600, (s) => nextSpeed(s, 0, dt, BIKES.bolinas, false))).toBeCloseTo(7, 5);
  });
  it('pushing up reaches the bike top speed', () => {
    expect(run(7, 600, (s) => nextSpeed(s, 1, dt, BIKES.bayview, false))).toBeCloseTo(9.5, 5);
  });
  it('braking stops the bike and never goes below zero', () => {
    expect(run(7, 120, (s) => nextSpeed(s, -1, dt, BIKES.bolinas, false))).toBe(0);
  });
  it('grass slows the Bayview more than the Bolinas', () => {
    const bolinas = run(0, 900, (s) => nextSpeed(s, 0, dt, BIKES.bolinas, true));
    const bayview = run(0, 900, (s) => nextSpeed(s, 0, dt, BIKES.bayview, true));
    expect(bayview).toBeLessThan(bolinas);
  });
  it('a winded rider pedals at 40 percent', () => {
    expect(run(0, 900, (s) => nextSpeed(s, 0, dt, BIKES.bolinas, false, 0.4))).toBeCloseTo(2.8, 5);
  });
});

describe('turnRate', () => {
  it('turns tighter at walking pace than at cruise', () => {
    expect(turnRate(1)).toBeGreaterThan(turnRate(7));
  });
});

describe('skid', () => {
  it('needs speed, a hard brake and a hard steer', () => {
    expect(isSkidding(7, -1, 1)).toBe(true);
    expect(isSkidding(7, -1, 0.2)).toBe(false);
    expect(isSkidding(7, 0, 1)).toBe(false);
    expect(isSkidding(2, -1, 1)).toBe(false);
  });
  it('turns sharper than steering, most of all for the Bayview on loose ground', () => {
    expect(skidTurnRate(7, BIKES.bolinas, false)).toBeGreaterThan(2 * turnRate(7));
    expect(skidTurnRate(7, BIKES.bayview, false)).toBeGreaterThan(skidTurnRate(7, BIKES.bolinas, false));
    expect(skidTurnRate(7, BIKES.bayview, true)).toBeGreaterThan(skidTurnRate(7, BIKES.bayview, false));
  });
});
