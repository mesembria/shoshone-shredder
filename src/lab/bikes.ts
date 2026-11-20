// The three bikes: the Bolinas trail bike, a dirt jumper and an enduro (the Bayview was dropped: "basically the same"
// as the Bolinas; the old prototype still has it in BIKES). A bike type is a set of overrides on the Tune settings, so
// the two new ones feel like different machines: the dirt jumper pops, spins and snaps round but is awful downhill;
// the enduro is the reverse.
import { BIKES, DEFAULT_KIT, type BikeSpec } from '../rules/bikes';
import { DEFAULTS, T, type TuneKey } from './tune';

export type LabBikeId = 'hardtail' | 'dirtjumper' | 'enduro' | 'bolinas';
type Ride = Partial<Record<TuneKey, number>>;

const SAME_RIDER = 0.35 / 0.36; // the Bolinas rider, on both new bikes
const trailBasics = { cruise: BIKES.bolinas.cruise, topSpeed: BIKES.bolinas.topSpeed, grassFactor: BIKES.bolinas.grassFactor, skid: BIKES.bolinas.skid };

export const LAB_BIKES: Record<LabBikeId, BikeSpec> = {
  hardtail: { id: 'hardtail', ...trailBasics, name: 'Hand-me-down Hardtail', frameColor: 0x7d8a96, wheelRadius: 0.32, spin: 0.7, riderScale: SAME_RIDER,
    // a plain, middling frame: no fork travel, no shock
    frame: { axle: 0.58, bb: [-0.04, 0.33], seat: [-0.27, 0.76], htTop: [0.37, 0.9], htBottom: [0.46, 0.68], bar: [0.42, 1.04] },
    kit: { ...DEFAULT_KIT, brakeFront: 'rim', brakeRear: 'rim' } },
  // the phase-0 Bolinas, with its parts drawn: a 130 mm air fork and 180 mm discs
  bolinas: { ...BIKES.bolinas, kit: { ...DEFAULT_KIT, fork: { kind: 'air', travel: 130 }, brakeFront: 180, brakeRear: 180 } },
  dirtjumper: { id: 'dirtjumper', ...trailBasics, name: 'Orange Dirt Jumper', frameColor: 0xf26b1d, wheelRadius: 0.29, spin: 1.35, riderScale: SAME_RIDER,
    // small, short and low, seat slammed, tall riser bars: the rider stands over it
    frame: { axle: 0.5, bb: [-0.04, 0.3], seat: [-0.24, 0.56], htTop: [0.33, 0.8], htBottom: [0.4, 0.62], bar: [0.38, 1.0] },
    kit: { ...DEFAULT_KIT, brakeRear: 160 } }, // rear disc only
  enduro: { id: 'enduro', ...trailBasics, name: 'Teal Enduro', frameColor: 0x1f8a8a, wheelRadius: 0.38, spin: 0.46, riderScale: SAME_RIDER,
    // long and slack, big fork, rear shock, wide bars
    frame: { axle: 0.68, bb: [-0.04, 0.36], seat: [-0.3, 0.95], htTop: [0.42, 0.98], htBottom: [0.52, 0.74], bar: [0.47, 1.08], barHalf: 0.38 },
    kit: { fork: { kind: 'air', travel: 170 }, rear: { design: 'linkage', shock: 'air', travel: 170 }, brakeFront: 180, brakeRear: 180 } },
};

export const LAB_ORDER: LabBikeId[] = ['hardtail', 'dirtjumper', 'enduro', 'bolinas'];

export const BIKE_RIDE: Record<LabBikeId, Ride> = {
  // the hand-me-down: heavy and cheap, so it does a bit of everything, badly (weak legs, tires out, wobbles early, no plow)
  hardtail: { hopFull: 5.6, lipPop: 0.4, steerResponse: 12, minRadius: 1.8, pump: 7, sprint: 11, maxSpeed: 15, brake: 8, grip: 8, rockCrash: 4, flatKeep: 0.85, legs: 3.7, rollUp: 0.18,
    energyCost: 1.25, pedalAccel: 4.4, wobbleSpeed: 11, wobbleKick: 1.3 },
  // the climber: strongest legs, cheapest climbing, tight switchback turns, forgives gravel
  bolinas: { legs: 4.4, energyCost: 0.8, minRadius: 1.1, looseLimit: 0.75, wobbleSpeed: 14, wobbleKick: 1.0 },
  // one gear (tops out early, bogs on steep pitches), small wheels: wobbles first and hardest
  dirtjumper: { hopFull: 7.5, lipPop: 0.65, steerResponse: 22, minRadius: 1.1, pump: 10, sprint: 10, maxSpeed: 13, brake: 6, grip: 7.5, rockCrash: 3, flatKeep: 0.75, legs: 3.8, rollUp: 0.12,
    energyCost: 1, gearTop: 8.5, gearBog: 0.4, wobbleSpeed: 10, wobbleKick: 1.4 },
  // heavy and plush: slow to get going, soaks a lazy pop, plows small rocks, steady at speed
  enduro: { hopFull: 5.2, lipPop: 0.35, steerResponse: 10, minRadius: 2.1, pump: 6, sprint: 12, maxSpeed: 19, brake: 13, grip: 10.5, rockCrash: 8.5, flatKeep: 0.95, legs: 4.2, rollUp: 0.22,
    energyCost: 1.1, pedalAccel: 4.2, popSoak: 0.4, plowSize: 0.35, wobbleSpeed: 18, wobbleKick: 0.3 },
};

// Every setting some bike owns. Picking a bike sets each one from that bike, or back to the default.
export const RIDE_KEYS: TuneKey[] = [...new Set(Object.values(BIKE_RIDE).flatMap((r) => Object.keys(r) as TuneKey[]))];

export function applyBike(id: LabBikeId, t: Record<TuneKey, number> = T): void {
  for (const k of RIDE_KEYS) t[k] = BIKE_RIDE[id][k] ?? DEFAULTS[k];
}

export function nextBike(id: LabBikeId): LabBikeId {
  return LAB_ORDER[(LAB_ORDER.indexOf(id) + 1) % LAB_ORDER.length];
}
