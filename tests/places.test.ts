import { describe, it, expect } from 'vitest';
import { buildPlace, homeFor, placeOfStation, PLACE_STATIONS, type PlaceId } from '../src/world/places';
import { CHALLENGES } from '../src/game/challenges';

const IDS: PlaceId[] = ['shredderHills', 'mesaJumpPark'];

describe('the two places', () => {
  it('list the stations each one builds', () => {
    for (const id of IDS) {
      const course = buildPlace(id);
      expect(course.place, id).toBe(id);
      expect(Object.keys(course.stations).sort(), id).toEqual([...PLACE_STATIONS[id]].sort());
    }
  });

  it('share no station key', () => {
    const all = IDS.flatMap((id) => PLACE_STATIONS[id]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('hold every challenge spot in exactly one place', () => {
    for (const c of CHALLENGES) expect(IDS.filter((id) => PLACE_STATIONS[id].includes(c.spot)), c.id).toHaveLength(1);
  });

  it('say which place a station is in', () => {
    expect(placeOfStation('Climb')).toBe('shredderHills');
    expect(placeOfStation('Jumps M')).toBe('mesaJumpPark');
    expect(placeOfStation('Street')).toBeNull();
  });

  it('send an old or unknown station key to the trailhead', () => {
    const trailhead = { place: 'shredderHills', station: 'Trailhead' };
    expect(homeFor('Street')).toEqual(trailhead);
    expect(homeFor('Hill top')).toEqual(trailhead);
    expect(homeFor('Old kickers')).toEqual(trailhead);
    expect(homeFor(null)).toEqual(trailhead);
    expect(homeFor('Jumps M')).toEqual({ place: 'mesaJumpPark', station: 'Jumps M' });
    expect(homeFor('Climb')).toEqual({ place: 'shredderHills', station: 'Climb' });
  });
});
