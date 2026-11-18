import { describe, it, expect } from 'vitest';
import { PARTS, loadout, stockFitted } from '../src/game/catalog';
import type { TuneKey } from '../src/lab/tune';
import { LAB_ORDER, type LabBikeId } from '../src/lab/bikes';
import { STAT_GROUPS, STAT_NAMES, statsFor, type Stat } from '../src/game/stats';

const STATS = STAT_GROUPS.flatMap((g) => g.stats);
const stock = (b: LabBikeId) => statsFor(loadout(b, stockFitted(b)));
const withPart = (id: string) => {
  const p = PARTS.find((x) => x.id === id)!;
  return statsFor(loadout(p.bike, { ...stockFitted(p.bike), [p.slot]: id }));
};
const diff = (id: string) => {
  const p = PARTS.find((x) => x.id === id)!;
  const a = stock(p.bike), b = withPart(id);
  return Object.fromEntries(STATS.map((s) => [s, +(b[s] - a[s]).toFixed(1)])) as Record<Stat, number>;
};

describe('stats', () => {
  it('groups and names cover all eight stats', () => {
    expect(STAT_GROUPS.map((g) => g.name)).toEqual(['Trail', 'Downhill', 'Park']);
    expect(STATS).toEqual(['climb', 'speed', 'grip', 'stop', 'stable', 'plow', 'pop', 'flick']);
    expect(STATS.map((s) => STAT_NAMES[s])).toEqual(['Climb', 'Speed', 'Grip', 'Stop', 'Stable', 'Plow', 'Pop', 'Flick']);
  });

  it('every stock value is within 0..10 with one decimal', () => {
    for (const b of LAB_ORDER) for (const s of STATS) {
      const v = stock(b)[s];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
      expect(v).toBe(Math.round(v * 10) / 10);
    }
  });

  it('stays within 0..10 with every part of a bike fitted at once', () => {
    for (const b of LAB_ORDER) {
      const fitted = { ...stockFitted(b) };
      for (const p of PARTS.filter((x) => x.bike === b && !x.stock)) fitted[p.slot] = p.id;
      const st = statsFor(loadout(b, fitted));
      for (const s of STATS) { expect(st[s]).toBeGreaterThanOrEqual(0); expect(st[s]).toBeLessThanOrEqual(10); }
    }
  });

  it('ranks the stock bikes the way they ride', () => {
    const s = Object.fromEntries(LAB_ORDER.map((b) => [b, stock(b)])) as Record<LabBikeId, Record<Stat, number>>;
    expect(s.dirtjumper.flick).toBeGreaterThan(s.bolinas.flick);
    expect(s.bolinas.flick).toBeGreaterThan(s.hardtail.flick);
    expect(s.hardtail.flick).toBeGreaterThan(s.enduro.flick);
    for (const b of ['hardtail', 'dirtjumper', 'bolinas'] as const) expect(s.enduro.plow).toBeGreaterThan(s[b].plow);
    for (const b of ['hardtail', 'dirtjumper', 'enduro'] as const) expect(s.bolinas.climb).toBeGreaterThan(s[b].climb);
    for (const b of ['hardtail', 'enduro', 'bolinas'] as const) expect(s.dirtjumper.climb).toBeLessThan(s[b].climb);
    for (const b of ['hardtail', 'dirtjumper', 'bolinas'] as const) expect(s.enduro.stable).toBeGreaterThan(s[b].stable);
    for (const b of ['hardtail', 'enduro', 'bolinas'] as const) expect(s.dirtjumper.stable).toBeLessThan(s[b].stable);
    for (const b of ['hardtail', 'enduro', 'bolinas'] as const) expect(s.dirtjumper.pop).toBeGreaterThan(s[b].pop);
    expect(s.hardtail.climb).toBeLessThan(s.bolinas.climb);
    expect(s.hardtail.stable).toBeLessThan(s.bolinas.stable);
  });

  it('sticky tires raise grip and lower speed', () => {
    const d = diff('hardtail-sticky-tires');
    expect(d.grip).toBeGreaterThan(0);
    expect(d.speed).toBeLessThan(0);
  });

  it('hydraulic brakes raise stop and nothing else moves', () => {
    const d = diff('hardtail-hydraulic-brakes');
    expect(d.stop).toBeGreaterThan(0);
    for (const s of STATS.filter((x) => x !== 'stop')) expect(d[s]).toBe(0);
  });

  // which way each setting a part can move is better for the bike (+1 higher, -1 lower)
  const BETTER: Partial<Record<TuneKey, 1 | -1>> = {
    grip: 1, bermGrip: 1, looseLimit: 1, brake: 1, wobbleSpeed: 1, plowSize: 1, rockCrash: 1, legs: 1, gearTop: 1, sprint: 1, pedalAccel: 1,
    flatKeep: 1, rollUp: 1, steerResponse: 1,
    rolling: -1, looseDrag: -1, skidDecel: -1, wobbleKick: -1, minRadius: -1, energyCost: -1, gearBog: -1, popSoak: -1,
  };
  it('every setting a part moves feeds some bar', () => {
    for (const p of PARTS.filter((x) => !x.stock)) for (const k of Object.keys(p.ride) as TuneKey[]) {
      const l = loadout(p.bike, stockFitted(p.bike));
      const nudged = { ...l, tune: { ...l.tune, [k]: l.tune[k] + (BETTER[k] ?? 1) * 0.5 } };
      const a = statsFor(l), b = statsFor(nudged);
      expect(STATS.some((s) => a[s] !== b[s]), `${p.id}: ${k}`).toBe(true);
    }
  });

  it('every trade-off part shows a loss on some bar', () => {
    for (const p of PARTS.filter((x) => !x.stock)) {
      for (const k of Object.keys(p.ride) as TuneKey[]) expect(BETTER[k], `${p.id}: which way is better for ${k}?`).toBeDefined();
      const tradeOff = (Object.entries(p.ride) as [TuneKey, number][]).some(([k, v]) => Math.sign(v) === -BETTER[k]!) || (p.spin ?? 0) < 0;
      if (!tradeOff) continue;
      const a = stock(p.bike), b = withPart(p.id);
      expect(STATS.filter((s) => b[s] < a[s]), p.id).not.toEqual([]);
    }
  });

  it('every upgrade part moves at least one bar by 0.3 or more', () => {
    for (const p of PARTS.filter((x) => !x.stock)) {
      const a = stock(p.bike), b = withPart(p.id);
      const biggest = Math.max(...STATS.map((s) => Math.abs(b[s] - a[s])));
      expect(biggest, p.id).toBeGreaterThanOrEqual(0.3 - 1e-9);
    }
  });
});
