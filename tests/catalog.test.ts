import { describe, it, expect } from 'vitest';
import { PARTS, SLOTS, SLOT_KEYS, SHEETS, applyLoadout, loadout, partsFor, stockFitted } from '../src/game/catalog';
import { BIKE_RIDE, LAB_BIKES, LAB_ORDER, RIDE_KEYS, type LabBikeId } from '../src/lab/bikes';
import { DEFAULTS, type TuneKey } from '../src/lab/tune';

const t = () => ({ ...DEFAULTS });
const base = (b: LabBikeId, k: TuneKey) => BIKE_RIDE[b][k] ?? DEFAULTS[k];
const withPart = (b: LabBikeId, id: string) => {
  const p = PARTS.find((x) => x.id === id)!;
  return loadout(b, { ...stockFitted(b), [p.slot]: id });
};
const delta = (b: LabBikeId, id: string, k: TuneKey) => withPart(b, id).tune[k] - base(b, k);

describe('the parts catalog', () => {
  it('every bike has exactly one stock part per slot', () => {
    for (const b of LAB_ORDER) for (const s of SLOTS) {
      const stock = partsFor(b, s).filter((p) => p.stock);
      expect(stock.length).toBe(1);
      expect(stock[0].ride).toEqual({});
      expect(stock[0].price).toBe(0);
    }
  });

  it('a part only touches its slot\'s keys and belongs to one bike', () => {
    const ids = new Set<string>();
    for (const p of PARTS) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(LAB_ORDER).toContain(p.bike);
      for (const k of Object.keys(p.ride)) expect(SLOT_KEYS[p.slot]).toContain(k);
    }
  });

  it('the stock loadout rides exactly as the bike does today', () => {
    for (const b of LAB_ORDER) {
      const x = t();
      const l = loadout(b, stockFitted(b));
      applyLoadout(l, x);
      for (const k of RIDE_KEYS) expect(x[k]).toBe(base(b, k));
      expect(l.spec.spin).toBe(LAB_BIKES[b].spin);
    }
  });

  it('sticky tires grip more and roll slower; fast tires the reverse', () => {
    expect(delta('hardtail', 'hardtail-sticky-tires', 'grip')).toBeGreaterThan(0);
    expect(delta('hardtail', 'hardtail-sticky-tires', 'rolling')).toBeGreaterThan(0);
    expect(delta('dirtjumper', 'dirtjumper-fast-tires', 'grip')).toBeLessThan(0);
    expect(delta('dirtjumper', 'dirtjumper-fast-tires', 'rolling')).toBeLessThan(0);
  });

  it('every sticky tire also holds gravel and rolls slower', () => {
    const sticky = PARTS.filter((p) => /sticky/i.test(p.id + p.name));
    expect(sticky.length).toBeGreaterThanOrEqual(2);
    for (const p of sticky) {
      expect(p.ride.grip ?? 0).toBeGreaterThan(0);
      expect((p.ride.looseLimit ?? 0) - (p.ride.looseDrag ?? 0)).toBeGreaterThan(0);
      expect(p.ride.rolling ?? 0).toBeGreaterThan(0);
    }
  });

  it('a fork that slackens the head angle turns wider and steers slower', () => {
    const forks = PARTS.filter((p) => p.headAngle);
    expect(forks.length).toBeGreaterThanOrEqual(3);
    for (const p of forks) {
      const sign = Math.sign(-p.headAngle!); // slacker (negative angle change) -> +1
      expect(sign * (p.ride.minRadius ?? 0)).toBeGreaterThan(0);
      expect(sign * (p.ride.steerResponse ?? 0)).toBeLessThan(0);
      expect(sign * (p.ride.wobbleSpeed ?? 0)).toBeGreaterThan(0);
    }
  });

  it('better brakes stop harder', () => {
    expect(delta('hardtail', 'hardtail-hydraulic-brakes', 'brake')).toBeGreaterThan(0);
  });

  it('the long fork slackens the head angle a degree', () => {
    expect(withPart('bolinas', 'bolinas-long-fork').sheet.headAngle).toBeCloseTo(SHEETS.bolinas.headAngle - 1);
    expect(withPart('bolinas', 'bolinas-short-fork').sheet.headAngle).toBeCloseTo(SHEETS.bolinas.headAngle + 1);
  });

  // The hand-me-down is left out on purpose: it is the deliberately worse bike (tight but slow-spinning, with turns
  // wider than the Bolinas), so it does not sit on the geometry line the other three follow.
  it('geometry and ride agree', () => {
    const bikes = (['dirtjumper', 'bolinas', 'enduro'] as LabBikeId[]).map((b) => loadout(b, stockFitted(b)));
    for (const slack of bikes) for (const steep of bikes) {
      if (slack.sheet.headAngle >= steep.sheet.headAngle) continue;
      expect(slack.tune.wobbleSpeed).toBeGreaterThanOrEqual(steep.tune.wobbleSpeed);
      expect(slack.tune.minRadius).toBeGreaterThanOrEqual(steep.tune.minRadius);
      expect(slack.spec.spin).toBeLessThanOrEqual(steep.spec.spin);
    }
  });

  it('the strongest brakes are grabby', () => {
    const brakes = PARTS.filter((p) => p.slot === 'brakes' && !p.stock);
    const top = brakes.reduce((a, b) => ((b.ride.brake ?? 0) > (a.ride.brake ?? 0) ? b : a));
    expect(top.id).toBe('enduro-4-piston-brakes');
    expect(top.ride.skidDecel ?? 0).not.toBe(0);
  });

  it('a part for another bike, or an unknown id, fits as stock', () => {
    const l = loadout('enduro', { suspension: 'hardtail-air-fork', tires: 'nope', brakes: 'enduro-4-piston-brakes' });
    expect(l.fitted).toEqual({ ...stockFitted('enduro'), brakes: 'enduro-4-piston-brakes' });
    expect(l.tune.wobbleSpeed).toBe(base('enduro', 'wobbleSpeed'));
  });

  it('a fitted part changes the kit, never the bike', () => {
    const before = JSON.stringify(LAB_BIKES.hardtail.kit);
    expect(withPart('hardtail', 'hardtail-air-fork').spec.kit!.fork).toEqual({ kind: 'air', travel: 120 });
    expect(withPart('enduro', 'enduro-4-piston-brakes').spec.kit!.brakeFront).toBe(203);
    expect(withPart('enduro', 'enduro-coil-shock').spec.kit!.rear).toEqual({ design: 'linkage', shock: 'coil', travel: 170 });
    for (const b of LAB_ORDER) expect(loadout(b, {}).spec.kit).toEqual(LAB_BIKES[b].kit);
    expect(JSON.stringify(LAB_BIKES.hardtail.kit)).toBe(before);
  });

  it('spec text and kit data agree', () => {
    for (const p of PARTS.filter((x) => x.slot === 'suspension' || x.slot === 'brakes')) {
      const mm = p.spec.match(/(\d+) mm/);
      if (!mm) continue;
      const kit = withPart(p.bike, p.id).spec.kit!;
      const data = p.slot === 'brakes' ? (typeof kit.brakeFront === 'number' ? kit.brakeFront : kit.brakeRear)
        : p.bike === 'enduro' ? kit.rear.travel : kit.fork.travel;
      expect(data, p.id).toBe(Number(mm[1]));
    }
  });

  it('a color paints the spec\'s frame without touching the bike', () => {
    expect(loadout('hardtail', {}, 0xff0000).spec.frameColor).toBe(0xff0000);
    expect(loadout('hardtail', {}).spec.frameColor).toBe(LAB_BIKES.hardtail.frameColor);
    expect(LAB_BIKES.hardtail.frameColor).not.toBe(0xff0000);
  });

  it('light wheels spin faster without changing the bike\'s own spin', () => {
    const l = withPart('enduro', 'enduro-light-wheels');
    expect(l.spec.spin).toBeGreaterThan(LAB_BIKES.enduro.spin);
    expect(LAB_BIKES.enduro.spin).toBe(0.46);
  });

  it('switching back to stock restores keys no bike owns', () => {
    const x = t();
    const sticky = withPart('hardtail', 'hardtail-sticky-tires');
    const touched = (Object.keys(sticky.tune) as TuneKey[]).filter((k) => !RIDE_KEYS.includes(k) && sticky.tune[k] !== DEFAULTS[k]);
    expect(touched.length).toBeGreaterThan(0); // rolling or bermGrip
    applyLoadout(sticky, x);
    for (const k of touched) expect(x[k]).not.toBe(DEFAULTS[k]);
    applyLoadout(loadout('hardtail', stockFitted('hardtail')), x);
    for (const k of touched) expect(x[k]).toBe(DEFAULTS[k]);
  });

  it('prices: hardtail free, other bikes well above five of the dearest part', () => {
    const dearest = Math.max(...PARTS.map((p) => p.price));
    expect(SHEETS.hardtail.price).toBe(0);
    for (const b of LAB_ORDER) if (b !== 'hardtail') expect(SHEETS[b].price).toBeGreaterThan(dearest * 5);
  });
});
