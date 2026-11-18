// The game's two places as plain data: their ids, their station keys and which station a ride starts at. Nothing here
// imports a builder, so the map and the page can ask without pulling the places' meshes in. (buildPlace is in ./index.)
export type PlaceId = 'shredderHills' | 'mesaJumpPark';

export const PLACE_IDS: readonly PlaceId[] = ['shredderHills', 'mesaJumpPark'];

// Each place's station keys; a test keeps these equal to what the builders make.
export const PLACE_STATIONS: Record<PlaceId, string[]> = {
  shredderHills: ['Trailhead', 'Climb', 'Summit', 'Switchbacks', 'Switchbacks top', 'Rock chute', 'Shoulder', 'Hilltop'],
  mesaJumpPark: ['Park lot', 'Jumps S', 'Jumps M', 'Jumps L', 'Jumps XL', 'Rhythm', 'Pump track', 'Slalom', 'Skinny', 'Start hill'],
};

export function placeOfStation(key: string): PlaceId | null {
  return PLACE_IDS.find((id) => PLACE_STATIONS[id].includes(key)) ?? null;
}

// Where a ride starts for a station key: its own place and station; for no key or an old one (the street, the old
// hill, ...) the hill's trailhead.
export function homeFor(key: string | null): { place: PlaceId; station: string } {
  const place = key ? placeOfStation(key) : null;
  return place ? { place, station: key! } : { place: 'shredderHills', station: 'Trailhead' };
}
