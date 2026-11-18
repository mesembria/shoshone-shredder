import { describe, it, expect } from 'vitest';
import { ringCard, areaList, challengeRow } from '../src/game/hub/map';
import { AREAS } from '../src/game/areas';
import { COG } from '../src/game/pieces';
import { CHALLENGES } from '../src/game/challenges';
import { COMBO_TIP } from '../src/game/targets';
import { loadoutOf, newProfile, starPays } from '../src/game/progress';

const p0 = newProfile('A'), l0 = loadoutOf(p0);
const def = (id: string) => CHALLENGES.find((c) => c.id === id)!;

describe('ring card', () => {
  it('a locked second challenge is one line', () => {
    const h = ringCard(p0, l0, [def('goatUp'), def('goatBoth')]);
    expect(h.match(/class="ring" data-c="goatUp"/g)?.length).toBe(1);
    expect(h).toContain('class="ring-lock" data-c="goatBoth"');
    expect(h).toContain('ui-hill both');
    expect(h).toContain('Clear Goat Ladder');
    expect(h).not.toContain('class="tabs"');
  });
  it('two open: tabs, the first picked unless told', () => {
    const p = { ...p0, stars: { goatUp: 1, goatDown: 1 } };
    const h = ringCard(p, loadoutOf(p), [def('goatUp'), def('goatBoth')]);
    expect(h.match(/class="tab"/g)?.length).toBe(2);
    expect(h).toContain('class="ring" data-c="goatUp"');
    expect(ringCard(p, loadoutOf(p), [def('goatUp'), def('goatBoth')], 'goatBoth')).toContain('class="ring" data-c="goatBoth"');
  });
  it('nothing open: the sign still names the ring, then each lock', () => {
    const h = ringCard(p0, l0, [def('hairpinUp'), def('hairpinBoth')]);
    expect(h).toContain('class="ui-sign"');
    expect(h).toContain('Hairpin Hollow');
    expect(h.match(/class="ring-lock"/g)?.length).toBe(2);
  });
  it('point goals: chips and the tip; timed: none', () => {
    expect(ringCard(p0, l0, [def('tableSmall')])).toContain(`<p class="tip">${COMBO_TIP}</p>`);
    expect(ringCard(p0, l0, [def('goatUp')])).not.toContain('class="chips"');
  });
});

describe('area list', () => {
  const park = AREAS.find((a) => a.id === 'mesaJumpPark')!, hills = AREAS.find((a) => a.id === 'shredderHills')!;
  it("locked rows with the same lock share one row, in the first one's place", () => {
    const h = areaList(p0, l0, park);
    expect(h.match(/class="row[ "]/g)?.length).toBe(5);
    expect(h).toContain('data-cs="tableBig tableXL"');
    expect(h).toContain('Table Row Big · XL');
    expect(h).toContain('Table Row Medium · The Pump House · The Plank');
    expect(areaList(p0, l0, hills).match(/class="row[ "]/g)?.length).toBe(7);
  });
  it('open rows: a slot per star, each empty one with its price and the cog', () => {
    const row = challengeRow(p0, def('tableSmall'));
    expect(row.match(/class="slot"/g)?.length).toBe(3);
    for (const c of starPays(p0, 'tableSmall').left) expect(row).toContain(`<small>${c}${COG}</small>`);
  });
});
