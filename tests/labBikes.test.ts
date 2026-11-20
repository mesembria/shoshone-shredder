import { describe, it, expect } from 'vitest';
import { applyBike, BIKE_RIDE, LAB_BIKES, LAB_ORDER, nextBike, RIDE_KEYS, type LabBikeId } from '../src/lab/bikes';
import { BIKES, kitOf } from '../src/rules/bikes';
import { DEFAULTS, type TuneKey } from '../src/lab/tune';

const t = () => ({ ...DEFAULTS });

describe('lab bikes', () => {
  it('writes the dirt jumper ride into the tuning', () => {
    const x = t();
    applyBike('dirtjumper', x);
    expect(x.hopFull).toBe(7.5);
    expect(x.rockCrash).toBe(3);
    expect(x.brake).toBe(6);
    expect(x.rollUp).toBe(0.12);
  });

  it('leaves nothing behind when swapping back to a trail bike', () => {
    const x = t(), fresh = t();
    applyBike('dirtjumper', x);
    applyBike('bolinas', x);
    applyBike('bolinas', fresh);
    for (const k of RIDE_KEYS) expect(x[k], k).toBe(fresh[k]);
  });

  it('leaves settings no bike owns alone', () => {
    const x = { ...t(), camBack: 7, stickFixed: 0 };
    applyBike('enduro', x);
    expect(x.camBack).toBe(7);
    expect(x.stickFixed).toBe(0);
  });

  it('makes the dirt jumper the trick bike and the enduro the downhill bike', () => {
    const dj = BIKE_RIDE.dirtjumper, en = BIKE_RIDE.enduro;
    for (const k of ['hopFull', 'lipPop', 'steerResponse', 'pump'] as const) expect(dj[k]!, k).toBeGreaterThan(en[k]!);
    for (const k of ['brake', 'grip', 'rockCrash', 'flatKeep', 'maxSpeed', 'rollUp', 'minRadius'] as const) expect(en[k]!, k).toBeGreaterThan(dj[k]!);
    expect(LAB_BIKES.dirtjumper.spin).toBeGreaterThan(LAB_BIKES.enduro.spin);
  });

  it('cycles through the four bikes', () => {
    let id: LabBikeId = 'hardtail';
    const seen: LabBikeId[] = [id];
    for (let i = 0; i < 4; i++) {
      id = nextBike(id);
      seen.push(id);
    }
    expect(seen).toEqual(['hardtail', 'dirtjumper', 'enduro', 'bolinas', 'hardtail']);
  });

  it('keeps the Bolinas frame and ride as they are, now with its fork and brakes drawn', () => {
    const { kit, ...rest } = LAB_BIKES.bolinas;
    expect(rest).toEqual(BIKES.bolinas);
    expect(kit!.fork).toEqual({ kind: 'air', travel: 130 });
  });

  it('makes the Bolinas the climber', () => {
    const b = BIKE_RIDE.bolinas, dj = BIKE_RIDE.dirtjumper, en = BIKE_RIDE.enduro;
    expect(b.legs!).toBeGreaterThan(dj.legs!);
    expect(b.legs!).toBeGreaterThan(en.legs!);
    expect(b.energyCost!).toBeLessThan(dj.energyCost!);
    expect(b.energyCost!).toBeLessThan(en.energyCost!);
    expect(b.looseLimit!).toBeGreaterThan(DEFAULTS.looseLimit);
    expect(b.minRadius!).toBeLessThanOrEqual(dj.minRadius!);
  });

  it('every bike wobbles, the dirt jumper first and hardest', () => {
    const ids: LabBikeId[] = ['dirtjumper', 'bolinas', 'enduro'];
    for (const id of ids) {
      const r = BIKE_RIDE[id];
      expect(r.wobbleSpeed!, id).toBeGreaterThan(0);
      expect(r.wobbleSpeed!, id).toBeLessThan(r.maxSpeed ?? DEFAULTS.maxSpeed);
    }
    const w = ids.map((id) => BIKE_RIDE[id].wobbleSpeed!), k = ids.map((id) => BIKE_RIDE[id].wobbleKick!);
    expect(w[0]).toBeLessThan(w[1]);
    expect(w[1]).toBeLessThan(w[2]);
    expect(k[0]).toBeGreaterThan(k[1]);
    expect(k[1]).toBeGreaterThan(k[2]);
  });

  it('only the dirt jumper has one gear, only the enduro soaks and plows', () => {
    for (const id of ['dirtjumper', 'enduro', 'bolinas'] as LabBikeId[]) {
      const x = t();
      applyBike(id, x);
      expect(x.gearTop > 0, id).toBe(id === 'dirtjumper');
      expect(x.gearBog > 0, id).toBe(id === 'dirtjumper');
      expect(x.popSoak > 0, id).toBe(id === 'enduro');
      expect(x.plowSize > 0, id).toBe(id === 'enduro');
    }
  });

  it('energy settings belong to no bike', () => {
    for (const k of ['energyTank', 'energyRefill', 'energyRest', 'energyClimb', 'energySteady', 'burntUntil', 'burntSlope', 'burntStop', 'burntRest']) {
      expect((RIDE_KEYS as string[]).includes(k), k).toBe(false);
      expect(k in DEFAULTS, k).toBe(true);
    }
  });

  it('drops the Bayview', () => {
    expect('bayview' in LAB_BIKES).toBe(false);
  });
});

describe('hardtail', () => {
  const r = (id: LabBikeId, k: TuneKey) => BIKE_RIDE[id][k] ?? DEFAULTS[k];
  it('does everything a little worse than the bike built for it', () => {
    expect(r('hardtail', 'legs')).toBeLessThan(r('bolinas', 'legs'));
    expect(r('hardtail', 'energyCost')).toBeGreaterThan(r('bolinas', 'energyCost'));
    expect(r('hardtail', 'wobbleSpeed')).toBeLessThan(r('bolinas', 'wobbleSpeed'));
    expect(r('hardtail', 'wobbleKick')).toBeGreaterThan(r('bolinas', 'wobbleKick'));
    expect(r('hardtail', 'plowSize')).toBe(0);
    expect(r('hardtail', 'hopFull')).toBeLessThan(r('dirtjumper', 'hopFull'));
    expect(LAB_BIKES.hardtail.spin).toBeLessThan(LAB_BIKES.bolinas.spin);
    expect(LAB_BIKES.hardtail.spin).toBeGreaterThan(LAB_BIKES.enduro.spin);
  });
  it('is the starter bike, a plain hardtail', () => {
    expect(LAB_ORDER[0]).toBe('hardtail');
    expect(LAB_BIKES.hardtail.name).toBe('Hand-me-down Hardtail');
    expect(kitOf(LAB_BIKES.hardtail)).toMatchObject({ fork: { kind: 'rigid' }, rear: { design: 'hardtail' } });
    expect(LAB_BIKES.hardtail.frameColor).toBe(0x7d8a96);
    expect(LAB_BIKES.hardtail.wheelRadius).toBeGreaterThan(LAB_BIKES.dirtjumper.wheelRadius);
    expect(LAB_BIKES.hardtail.wheelRadius).toBeLessThan(LAB_BIKES.bolinas.wheelRadius);
  });
});
