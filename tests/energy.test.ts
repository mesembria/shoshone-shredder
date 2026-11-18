import { describe, it, expect } from 'vitest';
import { energyLoad, stepEnergy, gearLimit, type Effort } from '../src/lab/energy';
import { DEFAULTS } from '../src/lab/tune';
import { BIKE_RIDE } from '../src/lab/bikes';

const DT = 1 / 60;
const tFor = (id?: 'dirtjumper' | 'bolinas' | 'enduro') => ({ ...DEFAULTS, ...(id ? BIKE_RIDE[id] : {}) });
const effort = (o: Partial<Effort>): Effort => ({ push: 0, pedaling: true, slope: 0, speed: 6, stopped: false, ...o });
function ride(t: ReturnType<typeof tFor>, e: Effort, seconds: number, from = 1): number {
  let x = from;
  for (let i = 0; i < seconds / DT; i++) x = stepEnergy(x, e, DT, t);
  return x;
}
function secondsToEmpty(t: ReturnType<typeof tFor>, e: Effort): number {
  let x = 1, n = 0;
  while (x > 0 && n < 60 * 120) {
    x = stepEnergy(x, e, DT, t);
    n++;
  }
  return n * DT;
}

describe('energy', () => {
  it('a full sprint on the flat empties the tank in about energyTank seconds', () => {
    const t = tFor();
    const s = secondsToEmpty(t, effort({ push: 1, speed: 8 }));
    expect(s).toBeGreaterThan(t.energyTank * 0.9);
    expect(s).toBeLessThan(t.energyTank * 1.1);
  });

  it('a steady push up a climb never empties the Bolinas, but refills slower than coasting', () => {
    const t = tFor('bolinas');
    for (const grade of [0.1, 0.2, 0.34]) {
      const e = effort({ slope: Math.atan(grade), speed: 1.5 });
      expect(ride(t, e, 30)).toBeGreaterThanOrEqual(0.85);
      expect(ride(t, e, 5, 0.5)).toBeLessThan(ride(t, effort({ pedaling: false }), 5, 0.5));
    }
  });

  it('the legs cap the load: without pushing, a steep pitch costs only the steady share; pushing pays it in full', () => {
    const t = tFor('bolinas');
    expect(energyLoad(effort({ slope: Math.atan(0.3), speed: 1 }), t)).toBeCloseTo(t.energyCost * t.steadyLegs, 5);
    expect(energyLoad(effort({ push: 1, slope: Math.atan(0.3), speed: 1 }), t)).toBeGreaterThan(t.energyCost * (1 + 0.5 * t.steadyLegs)); // standing on the pedals up a pitch costs more than a flat sprint
  });

  it('a steady push up a long 12% climb never burns out any bike except the bogging dirt jumper', () => {
    for (const id of ['bolinas', 'enduro'] as const) expect(ride(tFor(id), effort({ slope: Math.atan(0.12), speed: 2 }), 30)).toBeGreaterThan(0.3);
  });

  it('sprinting up a climb drains faster than on the flat', () => {
    const t = tFor();
    expect(ride(t, effort({ push: 1, slope: Math.atan(0.1), speed: 3 }), 3)).toBeLessThan(ride(t, effort({ push: 1, speed: 3 }), 3));
  });

  it('the dirt jumper bogs on steep pitches', () => {
    const e = effort({ push: 0.5, slope: Math.atan(0.15), speed: 3 });
    const drain = (id: 'dirtjumper' | 'bolinas') => 1 - ride(tFor(id), e, 2);
    expect(drain('dirtjumper')).toBeGreaterThan(1.3 * drain('bolinas'));
  });

  it('spinning out above gearTop still costs energy', () => {
    const t = tFor('dirtjumper');
    expect(ride(t, effort({ push: 1, speed: 9 }), 2)).toBeLessThan(1);
    expect(gearLimit(9, t)).toBe(0);
    expect(gearLimit(5, t)).toBe(1);
    expect(gearLimit(30, tFor('bolinas'))).toBe(1);
  });

  it('coasting refills most of the tank in a few seconds', () => {
    expect(ride(tFor(), effort({ pedaling: false }), 4, 0)).toBeGreaterThanOrEqual(0.45);
  });

  it('cruising on the flat (stick let go) refills as fast as coasting', () => {
    const t = tFor('dirtjumper');
    expect(ride(t, effort({ push: 0 }), 2, 0)).toBeCloseTo(ride(t, effort({ pedaling: false }), 2, 0), 3);
  });

  it('stopped refills fastest', () => {
    const t = tFor(), stopped = effort({ pedaling: false, stopped: true, speed: 0 });
    expect(ride(t, stopped, 1, 0)).toBeGreaterThan(ride(t, effort({ pedaling: false }), 1, 0));
    let x = 0, n = 0;
    while (x < 0.33) {
      x = stepEnergy(x, stopped, DT, t);
      n++;
    }
    expect(n * DT).toBeGreaterThanOrEqual(1.5);
    expect(n * DT).toBeLessThanOrEqual(2.5);
  });

  it('coasting never drains', () => {
    const t = tFor('enduro');
    let x = 0.5;
    for (let i = 0; i < 120; i++) {
      const next = stepEnergy(x, effort({ pedaling: false, push: 1, slope: 0.2 }), DT, t);
      expect(next).toBeGreaterThanOrEqual(x);
      x = next;
    }
  });

  it('energyTank 0 turns energy off', () => {
    const t = { ...tFor(), energyTank: 0 };
    expect(stepEnergy(0.2, effort({ push: 1 }), DT, t)).toBe(1);
  });

  it('a harder load means more energy used', () => {
    const t = tFor();
    expect(energyLoad(effort({ push: 1 }), t)).toBeGreaterThan(energyLoad(effort({ push: 0 }), t));
    expect(energyLoad(effort({ pedaling: false, push: 1 }), t)).toBe(0);
  });
});
