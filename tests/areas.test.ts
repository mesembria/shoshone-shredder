import { describe, it, expect } from 'vitest';
import { AREAS, PLACE_NAMES, areaStars } from '../src/game/areas';
import { CHALLENGES, canStart, lockText } from '../src/game/challenges';
import { loadoutOf, newProfile } from '../src/game/progress';
import { buildPlace, PLACE_IDS, PLACE_STATIONS } from '../src/world/places';

describe('areas', () => {
  it('has two areas, Shredder Hills and Mesa Jump Park, holding every challenge once', () => {
    expect(AREAS.map((a) => a.name)).toEqual(['Shredder Hills', 'Mesa Jump Park']);
    const ids = AREAS.flatMap((a) => a.challenges);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(CHALLENGES.map((c) => c.id).sort());
  });

  it('each area is a place, and its challenges\' spots are that place\'s stations', () => {
    expect(AREAS.map((a) => a.id)).toEqual([...PLACE_IDS]);
    for (const a of AREAS) for (const id of a.challenges) {
      const c = CHALLENGES.find((x) => x.id === id)!;
      expect(PLACE_STATIONS[a.id as keyof typeof PLACE_STATIONS], `${id} @ ${c.spot}`).toContain(c.spot);
    }
    expect(AREAS.map((a) => a.challenges.length)).toEqual([7, 8]);
    expect(AREAS[0].map).not.toEqual(AREAS[1].map);
  });

  it('names every challenge spot, and every named place is a station', () => {
    const stations = new Set(PLACE_IDS.flatMap((id) => Object.keys(buildPlace(id).stations)));
    for (const c of CHALLENGES) expect(PLACE_NAMES[c.spot], c.spot).toBeTruthy();
    for (const key of Object.keys(PLACE_NAMES)) expect(stations.has(key), key).toBe(true);
    expect(PLACE_NAMES['Jumps S']).toBe('Table Row Small');
    expect(PLACE_NAMES.Climb).toBe('Goat Ladder');
    expect(PLACE_NAMES.Switchbacks).toBe('Hairpin Hollow');
    expect(PLACE_NAMES.Street).toBeUndefined();
    expect(PLACE_NAMES).toMatchObject({ Trailhead: 'Trailhead', Shoulder: 'The shoulder', Hilltop: 'The summit', 'Park lot': 'Park lot', 'Start hill': 'Start hill' });
  });

  it('counts only the area\'s stars', () => {
    const p = { ...newProfile('Ada'), stars: { goatUp: 2, tableSmall: 3, oldThing: 5 } };
    expect(areaStars(p, AREAS[0])).toBe(2);
    expect(areaStars(p, AREAS[1])).toBe(3);
    expect(areaStars(newProfile('Bo'), AREAS[0])).toBe(0);
  });

  // Frozen from the one-area code (commit d611479): locks count stars across both areas now, as they did across the one.
  it('an old save keeps its stars and its locks', () => {
    const full: Record<string, number> = { goatUp: 3, goatDown: 2, goatBoth: 1, hairpinUp: 1, hairpinDown: 1, hairpinBoth: 2, boulderDash: 3, tableSmall: 2, tableMedium: 1, tableBig: 3, tableXL: 1, whoop: 2, pumpHouse: 1, coneZone: 3, plank: 2 };
    expect(Object.keys(full)).toHaveLength(15);
    expect(AREAS.reduce((n, a) => n + areaStars({ ...newProfile('Old'), stars: full }, a), 0)).toBe(28);
    const open = (stars: Record<string, number>) => {
      const p = { ...newProfile('Old'), stars };
      return CHALLENGES.filter((c) => canStart(p, c, loadoutOf(p))).map((c) => c.id);
    };
    // (Boulder Dash and the Plank also need a bike stat the stock hardtail lacks)
    expect(open(full)).toEqual(['goatUp', 'goatDown', 'goatBoth', 'hairpinUp', 'hairpinDown', 'hairpinBoth', 'tableSmall', 'tableMedium', 'tableBig', 'tableXL', 'whoop', 'pumpHouse', 'coneZone']);
    expect(open({ tableSmall: 3, goatUp: 1 })).toEqual(['goatUp', 'goatDown', 'hairpinUp', 'hairpinDown', 'tableSmall', 'tableMedium', 'whoop', 'pumpHouse', 'coneZone']);
    expect(open({ coneZone: 1, tableSmall: 2 })).toEqual(['goatUp', 'goatDown', 'hairpinUp', 'hairpinDown', 'tableSmall', 'tableMedium', 'pumpHouse', 'coneZone']);
  });

  it('lock text counts total stars', () => {
    const p = { ...newProfile('Ada'), stars: { tableSmall: 1 } };
    expect(lockText(p, CHALLENGES.find((c) => c.id === 'tableMedium')!, loadoutOf(p))).toBe('Ride 2 ★');
  });
});
