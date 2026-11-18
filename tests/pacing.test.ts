// The pacing targets from the spec, checked from the numbers alone (PAY, prices, the challenge list): the first upgrade
// after about three first clears, the first new bike after most of the area's 2-star clears, bikes far dearer than parts.
import { describe, it, expect } from 'vitest';
import { PARTS, SHEETS } from '../src/game/catalog';
import { CHALLENGES } from '../src/game/challenges';
import { AREAS } from '../src/game/areas';
import { PAY, newProfile, loadoutOf } from '../src/game/progress';
import { canStart } from '../src/game/challenges';
import { LAB_ORDER } from '../src/lab/bikes';

const fresh = newProfile('Ada');
const starting = CHALLENGES.filter((c) => canStart(fresh, c, loadoutOf(fresh)));
const upgrades = PARTS.filter((p) => !p.stock);
const bikes = LAB_ORDER.filter((b) => b !== 'hardtail').map((b) => SHEETS[b].price);

describe('pacing', () => {
  it('the first upgrade is affordable after about three first clears', () => {
    expect(starting.length).toBe(3);
    const cheapest = Math.min(...upgrades.filter((p) => p.bike === 'hardtail').map((p) => p.price));
    expect(cheapest).toBeLessThanOrEqual(3 * PAY.tiers[0]);
    expect(cheapest).toBeGreaterThan(2 * PAY.tiers[0]);
  });

  it('the first new bike takes most of the area\'s 2★ clears', () => {
    const area = AREAS.flatMap((a) => a.challenges).length * (PAY.tiers[0] + PAY.tiers[1]);
    const cheapest = Math.min(...bikes);
    expect(cheapest).toBeGreaterThanOrEqual(0.6 * area);
    expect(cheapest).toBeLessThanOrEqual(0.9 * area);
  });

  it('bikes cost far more than parts', () => {
    expect(Math.min(...bikes)).toBeGreaterThanOrEqual(5 * Math.max(...upgrades.map((p) => p.price)));
  });
});
