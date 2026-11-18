// Mesa Jump Park: today's jump features, unchanged in shape and run-up, strung on one flow line over flat golden ground
// (x is east, z is south). A start hill (3 m, dirt, built from the same extruded profiles as the features, no generated
// terrain) stands at the west end. The four Table Row lanes drop off its east face side by side (small, medium, large,
// XL, from north to south), and Whoop-de-Doo's roll-in is the hill's north end. Riding on: the lanes run east into a
// cross pad and one banked U-turn at the far end, back west on a return path to the foot of the hill's climb ramp, up
// to the top again. Whoop-de-Doo runs east from the hill and its run-out carries on, straight, to the Pump House
// entrance. The pump track's exit path comes round the east side to join the return path. The Plank and Cone Zone sit
// on flat ground by a gravel lot with the family car and a fence, south of the hill.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../../look/palette';
import {
  DIRT, JUMPS, PLANKS as OLD_PLANKS, PUMP_TRACK as OLD_PUMP, Profile, SLALOM as OLD_SLALOM, V, berm, bumpers, extrude, lipBar, mesh,
  pumpTrackGeo, planks, slab, slalomGates, tabletop,
  type Area, type Course, type Gate, type Line, type Plank, type PumpTrack, type Slalom, type Station,
} from '../../lab/course';
import { car } from '../build';
import { makePlan } from './plan';

const LAND = 0xc8b76c; // golden grass, as the hill's
const PATH = 0x97785a; // the dirt paths and lane strips

// Whoop-de-Doo's line: a roll-in, five doubles (a lip, a gap, a landing mound), ridden without pedaling. Returns where
// pedaling is off (the deck lets you pedal to the edge) and the start station on the roll-in.
export function rhythmLine(w: THREE.Group, lines: Line[], R: { x0: number; z: number; width: number }): { coast: Area; station: Station } {
  const { x0, z, width } = R, p = new Profile();
  p.pts[0] = [0, 3];
  p.flat(3).convex(0, -22, 4).landing(22, 4).flat(3);
  for (let i = 0; i < 5; i++) {
    p.kick(1, 28);
    const lipU = p.u, lipH = p.h;
    p.pts.push([p.u, 0.25]); // the back of the lip drops into the gap
    p.flat(2.4).slopeTo(40, 0.95).flat(0.6);
    const knuckle = p.u;
    p.landing(19, 4);
    const landLen = p.u - knuckle;
    p.flat(2.5);
    lipBar(w, x0 + lipU, lipH + 0.02, z, width);
    lines.push({ lip: V(x0 + lipU, lipH, z), yaw: 0, width, after: 0, land: { knuckle: knuckle - lipU, length: landLen, drop: lipH } });
  }
  p.flat(6);
  extrude(w, p, x0, 0.02, z, 0, width, DIRT, 'dirt');
  return { coast: { x0: x0 + 3, x1: x0 + p.u + 2, z0: z - 4, z1: z + 4 }, station: { pos: V(x0 + 1, 3.04, z), yaw: 0 } };
}

// ---- where things are (the constants the robots, spots.ts and the tests read)
export const LANES = { S: 10, M: 20, L: 30, XL: 40 }; // each Table Row lane's z; every lane runs east
export const XL_LANE = LANES.XL;
export const LANE_X0 = -30; // where the first table starts (the same as the old park's lanes), and the stations stand 32 m back
export const RHYTHM = { x0: -80, z: -14, width: 3 }; // the roll-in stands on the hill's north end (3 m up)
export const PUMP_TRACK: PumpTrack = { ...OLD_PUMP, x: 54, z: -8.5 }; // its near straight lines up with Whoop-de-Doo's
const LOT = { x0: -84, x1: 24, z0: 62, z1: 82 };
export const SLALOM: Slalom = { ...OLD_SLALOM, z: 72 }; // down the middle of the lot
export const PLANKS: Plank[] = OLD_PLANKS.map((p, i) => ({ ...p, z: i ? 93 : 88 }));
const HILL = { x0: -96, top: 3, face: -80, z0: -20, z1: 46, ramp: { z: 54, width: 6 } }; // face: where the roll-in face starts
const PUMP_PAD: Area = { x0: PUMP_TRACK.x - 26, x1: PUMP_TRACK.x + 26, z0: PUMP_TRACK.z - 10.5, z1: PUMP_TRACK.z + 10.5 };
const FAR = { pad: { x0: 34, x1: 50 }, berm: { cx: 44, R: 7, width: 4.5 } }; // the lanes' far end: a cross pad and the U-turn
const RETURN_Z = LANES.XL + 2 * FAR.berm.R; // the U-turn comes back west at z = 54

const strip = (w: THREE.Group, x0: number, x1: number, z0: number, z1: number, color = PATH) => slab(w, x0, x1, z0, z1, 0, 0.02, color, 'dirt', true);

export function buildPark(): Course {
  const w = new THREE.Group(), lines: Line[] = [], gates: Gate[] = [];

  // the golden ground, wide enough that riding off the edge never falls through
  slab(w, -300, 300, -160, 220, -0.5, 0.5, LAND, 'grass', true);

  // ---- the start hill: a 3 m block, its east face rolling in to the lanes (the same roll-in as Whoop-de-Doo's), and a
  // gentle climb ramp up its south end from the return path
  {
    const roll = new Profile();
    roll.pts[0] = [0, HILL.top];
    roll.flat(3).convex(0, -22, 4).landing(22, 4).flat(1);
    extrude(w, roll, HILL.face, 0, (HILL.z0 + HILL.z1) / 2, 0, HILL.z1 - HILL.z0, DIRT, 'dirt');
    const { z, width } = HILL.ramp, top = HILL.top;
    slab(w, HILL.x0, HILL.face + 0.01, HILL.z0, z + width / 2, 0, top, DIRT, 'dirt'); // the deck behind the face, to the ramp's edge
    const ramp = new Profile().slopeTo(5, top); // the climb: 5 degrees, west up onto the deck
    ramp.flat(1);
    extrude(w, ramp, HILL.face + ramp.u - 1, 0, z, Math.PI, width, DIRT, 'dirt');
  }

  // ---- Table Row: four lanes drop off the hill's east face, tables as the old park has them
  for (const z of Object.values(LANES)) strip(w, -66, FAR.pad.x1, z - 3, z + 3);
  let x = LANE_X0;
  for (let i = 0; i < 3; i++) x = tabletop(w, lines, JUMPS.S, x, 0.02, LANES.S) + 9;
  x = LANE_X0;
  for (let i = 0; i < 2; i++) x = tabletop(w, lines, JUMPS.M, x, 0.02, LANES.M) + 12;
  tabletop(w, lines, JUMPS.L, -25, 0.02, LANES.L);
  tabletop(w, lines, JUMPS.XL, LANE_X0, 0.02, XL_LANE);

  // ---- the far end: a cross pad across all four lanes, a banked U-turn off the XL lane, and the return path west
  {
    const { cx, R, width } = FAR.berm;
    strip(w, FAR.pad.x0, FAR.pad.x1, LANES.S - 3, LANES.XL + 3);
    berm(w, cx, XL_LANE + R, 1, R, width, 1.5, 0.02);
    strip(w, HILL.face + 34.3, 90, RETURN_Z - 2.5, RETURN_Z + 2.5); // the return path, from the climb's foot out east to meet the pump track's exit
  }

  // ---- Whoop-de-Doo, off the hill's north end, and its run-out straight to the Pump House entrance
  const rh = rhythmLine(w, lines, RHYTHM);
  const rhythmEnd = rh.coast.x1 - 2;
  strip(w, rhythmEnd - 1, PUMP_TRACK.x - PUMP_TRACK.half + 1, RHYTHM.z - 2, RHYTHM.z + 2);

  // ---- the Pump House, with its exit path round the east side down to the return path
  pumpTrackGeo(w, PUMP_TRACK, PUMP_PAD);
  strip(w, PUMP_PAD.x1 - 1, 88, PUMP_TRACK.z - 2, PUMP_TRACK.z + 2);
  strip(w, 84, 88, PUMP_TRACK.z - 2, RETURN_Z + 2.5);

  // ---- the gravel lot: Cone Zone's gates down its middle, the family car, a split-rail fence; the Plank beyond it
  {
    const pad = mesh(new THREE.BoxGeometry(LOT.x1 - LOT.x0, 0.3, LOT.z1 - LOT.z0), C.gravel, 'ground', true);
    pad.position.set((LOT.x0 + LOT.x1) / 2, 0.04 - 0.15, (LOT.z0 + LOT.z1) / 2);
    w.add(pad);
    slalomGates(w, gates, SLALOM);
    car(w, -72, LOT.z1 - 3, 0, C.suv, false);
    const geos: THREE.BufferGeometry[] = [], fz = LOT.z1 - 0.6, f0 = LOT.x0 + 4, f1 = -40;
    for (let fx = f0; fx <= f1 + 0.01; fx += 2.4) geos.push(new THREE.CylinderGeometry(0.08, 0.09, 1.15, 6).translate(fx, 0.575, fz));
    for (const y of [0.5, 0.95]) geos.push(new THREE.BoxGeometry(f1 - f0, 0.09, 0.07).translate((f0 + f1) / 2, y, fz));
    w.add(mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), C.wood, 'wall'));
    strip(w, -34, -30, RETURN_Z, LOT.z0 + 0.5); // the path down from the return path to the lot
    strip(w, -40, -36, LOT.z1 - 0.5, PLANKS[0].z); // and from the lot to the Plank
    slab(w, -64, 24, PLANKS[0].z - 4, PLANKS[1].z + 4, -0.02, 0.04, C.gravel, 'ground', true); // a hard pad under the approach, the planks and the run-out
    planks(w, lines, PLANKS);
  }

  // ---- stations, rings, zones
  const cz = SLALOM.z ?? 0;
  const stations: Record<string, Station> = {
    'Park lot': { pos: V(-76, 0.04, LOT.z0 + 4), yaw: 0 },
    'Jumps S': { pos: V(-62, 0.02, LANES.S), yaw: 0 },
    'Jumps M': { pos: V(-62, 0.02, LANES.M), yaw: 0 },
    'Jumps L': { pos: V(-62, 0.02, LANES.L), yaw: 0 },
    'Jumps XL': { pos: V(-62, 0.02, XL_LANE), yaw: 0 },
    Rhythm: rh.station,
    'Pump track': { pos: V(PUMP_TRACK.x - PUMP_TRACK.half + 0.5, 0.02, PUMP_TRACK.z - PUMP_TRACK.R), yaw: 0, speed: 6 },
    Slalom: { pos: V(-64, 0.04, cz + 2), yaw: 0 },
    Skinny: { pos: V(-38, 0, PLANKS[0].z), yaw: 0 },
    'Start hill': { pos: V(-88, HILL.top + 0.04, 20), yaw: 0 },
  };
  const ring = (s: Station) => ({ x: s.pos.x, z: s.pos.z });
  const lane = (z: number): Area => ({ x0: -76, x1: 64, z0: z - 5, z1: z + 5 });
  const rings: Course['rings'] = {
    'Jumps S': ring(stations['Jumps S']), 'Jumps M': ring(stations['Jumps M']), 'Jumps L': ring(stations['Jumps L']), 'Jumps XL': ring(stations['Jumps XL']),
    Rhythm: ring(stations.Rhythm), Slalom: ring(stations.Slalom), Skinny: ring(stations.Skinny),
    // on the pad beside the loop, so riding laps never runs through it
    'Pump track': { x: PUMP_TRACK.x - 22, z: PUMP_TRACK.z + 8.5 },
  };
  const zones: Record<string, Area> = {
    'Jumps S': lane(LANES.S), 'Jumps M': lane(LANES.M), 'Jumps L': lane(LANES.L), 'Jumps XL': lane(XL_LANE),
    Rhythm: { x0: RHYTHM.x0 - 2, x1: RHYTHM.x0 + 94, z0: RHYTHM.z - 5, z1: RHYTHM.z + 5 },
    'Pump track': { x0: PUMP_TRACK.x - 32, x1: PUMP_TRACK.x + 32, z0: PUMP_TRACK.z - 18, z1: PUMP_TRACK.z + 18 },
    Slalom: { x0: -80, x1: SLALOM.x0 + (SLALOM.count - 1) * SLALOM.step + 10, z0: cz - 9, z1: cz + 9 },
    Skinny: { x0: -46, x1: 2, z0: PLANKS[0].z - 6, z1: PLANKS[1].z + 6 },
  };
  // the scenery plan: every feature's footprint (the boxes round the park's meshes, but not the ground), the stations and the rings
  w.updateMatrixWorld(true);
  const blockers = { segs: [] as number[][], rects: [] as number[][], discs: [] as number[][] }, box = new THREE.Box3();
  w.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    box.setFromObject(o);
    if (box.max.x - box.min.x > 200 && box.max.z - box.min.z > 200) return; // the ground itself
    blockers.rects.push([box.min.x, box.min.z, box.max.x, box.max.z]);
  });
  for (const s of Object.values(stations)) blockers.discs.push([s.pos.x, s.pos.z, 1.5]);
  for (const c of Object.values(rings)) blockers.discs.push([c.x, c.z, 3]);
  for (const l of lines) blockers.discs.push([l.lip.x, l.lip.z, l.width / 2 + 1]);
  const extent = { x0: -130, x1: 130, z0: -60, z1: 130 };
  const scenery = makePlan({ seed: 42, extent, ground: () => 0, blockers, home: stations['Park lot'].pos });
  return {
    world: w, decor: [], lines, gates, bumpers: bumpers([]), stations, coast: [PUMP_PAD, rh.coast],
    climb: { area: [], loose: [], ledges: [], start: { a: new THREE.Vector2(), b: new THREE.Vector2() }, top: { a: new THREE.Vector2(), b: new THREE.Vector2() } },
    rough: [], runs: {}, place: 'mesaJumpPark', home: 'Park lot', trails: {}, rings, zones, pumpTrack: PUMP_TRACK, planks: PLANKS, scenery,
  };
}
