// Areas on the map: Shredder Hills (the trails) and Mesa Jump Park (the features), one per place in world/places. Their
// challenges have kid names; the courses keep their station keys (the teleport targets), and PLACE_NAMES is what the
// page shows for them.
import type { Profile } from './progress';

export interface AreaDef { id: string; name: string; symbol: 'green' | 'blue' | 'black'; map: { x: number; y: number }; challenges: string[] }

// map: where its pin sits on the map, as fractions of the map's width and height
export const AREAS: AreaDef[] = [
  {
    id: 'shredderHills', name: 'Shredder Hills', symbol: 'green', map: { x: 0.5, y: 0.55 },
    challenges: ['goatUp', 'goatDown', 'goatBoth', 'hairpinUp', 'hairpinDown', 'hairpinBoth', 'boulderDash'],
  },
  {
    // on the mesa's flat top, the grass below the Flatirons, clear of Shredder Hills' pin
    id: 'mesaJumpPark', name: 'Mesa Jump Park', symbol: 'green', map: { x: 0.58, y: 0.75 },
    challenges: ['tableSmall', 'tableMedium', 'tableBig', 'tableXL', 'whoop', 'pumpHouse', 'coneZone', 'plank'],
  },
];

// Station key → the name the kids see. The places only "Just ride" goes to are named here too.
export const PLACE_NAMES: Record<string, string> = {
  Trailhead: 'Trailhead',
  Shoulder: 'The shoulder',
  Hilltop: 'The summit',
  'Park lot': 'Park lot',
  'Start hill': 'Start hill',
  Climb: 'Goat Ladder',
  Summit: 'Goat Ladder top',
  Switchbacks: 'Hairpin Hollow',
  'Switchbacks top': 'Hairpin Hollow top',
  'Rock chute': 'Boulder Dash',
  Rhythm: 'Whoop-de-Doo',
  'Jumps S': 'Table Row Small',
  'Jumps M': 'Table Row Medium',
  'Jumps L': 'Table Row Big',
  'Jumps XL': 'Table Row XL',
  'Pump track': 'The Pump House',
  Slalom: 'Cone Zone',
  Skinny: 'The Plank',
};

export function areaStars(p: Profile, a: AreaDef): number {
  return a.challenges.reduce((n, id) => n + (p.stars[id] ?? 0), 0);
}
