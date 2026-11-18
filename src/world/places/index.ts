// The game's two places and how to get between them: Shredder Hills (the trails) and Mesa Jump Park (the features).
// The ids, stations and homeFor are plain data in ./data (what the map and page import); this adds the builders.
import type { Course } from '../../lab/course';
import { buildHill } from './hill';
import { buildPark } from './park';
import type { PlaceId } from './data';

export { PLACE_IDS, PLACE_STATIONS, placeOfStation, homeFor, type PlaceId } from './data';

export function buildPlace(id: PlaceId): Course {
  return id === 'mesaJumpPark' ? buildPark() : buildHill();
}
