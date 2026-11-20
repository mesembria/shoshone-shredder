import { describe, it, expect } from 'vitest';
import { BIKES, DEFAULT_KIT, kitOf, withKit } from '../src/rules/bikes';
import { LAB_BIKES } from '../src/lab/bikes';

describe('bike kits', () => {
  it('phase-0 bikes get the default kit', () => {
    expect(kitOf(BIKES.bolinas)).toEqual(DEFAULT_KIT);
    expect(kitOf(BIKES.bayview)).toEqual(DEFAULT_KIT);
    expect(DEFAULT_KIT).toEqual({ fork: { kind: 'rigid', travel: 0 }, rear: { design: 'hardtail', shock: 'air', travel: 0 }, brakeFront: 'none', brakeRear: 'none' });
  });

  it('stock kits match the spec table', () => {
    expect(kitOf(LAB_BIKES.hardtail)).toEqual({ fork: { kind: 'rigid', travel: 0 }, rear: { design: 'hardtail', shock: 'air', travel: 0 }, brakeFront: 'rim', brakeRear: 'rim' });
    expect(kitOf(LAB_BIKES.bolinas).fork).toEqual({ kind: 'air', travel: 130 });
    expect(kitOf(LAB_BIKES.bolinas).rear.design).toBe('hardtail');
    expect(kitOf(LAB_BIKES.enduro).rear).toEqual({ design: 'linkage', shock: 'air', travel: 170 });
    expect(kitOf(LAB_BIKES.enduro).fork).toEqual({ kind: 'air', travel: 170 });
    expect(kitOf(LAB_BIKES.dirtjumper).brakeFront).toBe('none');
    expect(kitOf(LAB_BIKES.dirtjumper).brakeRear).toBe(160);
  });

  it('withKit merges rear shallowly and copies', () => {
    const base = kitOf(LAB_BIKES.enduro);
    const k = withKit(base, { rear: { shock: 'coil' } });
    expect(k.rear).toEqual({ design: 'linkage', shock: 'coil', travel: 170 });
    expect(base.rear.shock).toBe('air');
  });
});
