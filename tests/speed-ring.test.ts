import { describe, it, expect } from 'vitest';
import { SPEED_FULL, ZONE_WORD, speedZone, ringSegments } from '../src/lab/speed-ring';
import { BIKE_RIDE } from '../src/lab/bikes';

// the hardtail: sprint 11, cruise 2.5 under it, top speed from hills 15
const HT = { cruise: 8.5, sprint: 11, maxSpeed: 15 };

describe('speed ring', () => {
  it('full scale is a little over the fastest bike', () => {
    expect(SPEED_FULL).toBe(21);
    expect(SPEED_FULL).toBeGreaterThan(Math.max(...Object.values(BIKE_RIDE).map((r) => r.maxSpeed ?? 0)));
  });
  it('zones from the bike', () => expect([8.4, 8.5, 11, 15, 15.01].map((v) => speedZone(v, HT))).toEqual(['pedal', 'sprint', 'hill', 'hill', 'over']));
  it('segment colors', () =>
    expect(ringSegments(0, HT).map((s) => s.zone).join()).toBe([...Array(6).fill('pedal'), 'sprint', 'sprint', 'hill', 'hill', 'hill', ...Array(5).fill('over')].join()));
  it('lights in order, clamps at full', () => {
    expect(ringSegments(0, HT).filter((s) => s.lit).length).toBe(0);
    expect(ringSegments(10, HT).filter((s) => s.lit).length).toBe(8);
    expect(ringSegments(99, HT).every((s) => s.lit)).toBe(true);
    expect(ringSegments(10, HT).findIndex((s) => !s.lit)).toBe(8);
  });
  it('words', () => expect([ZONE_WORD.pedal, ZONE_WORD.sprint, ZONE_WORD.hill, ZONE_WORD.over]).toEqual(['pedal', 'sprint', 'hill speed', 'hill speed']));
});
