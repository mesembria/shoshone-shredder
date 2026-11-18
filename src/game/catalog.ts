// The parts catalog: five slots per bike, one stock part in each plus a few upgrades. A part is a set of deltas ADDED to
// the bike's base ride, so a loadout is bike + parts and nothing in the lab needs to know a part's name.
import { BIKE_RIDE, LAB_BIKES, RIDE_KEYS, type LabBikeId } from '../lab/bikes';
import { DEFAULTS, T, type TuneKey } from '../lab/tune';
import type { BikeSpec } from '../rules/bikes';

export type Slot = 'suspension' | 'tires' | 'brakes' | 'cockpit' | 'drivetrain';
export const SLOTS: Slot[] = ['suspension', 'tires', 'brakes', 'cockpit', 'drivetrain'];

export interface PartDef {
  id: string; bike: LabBikeId; slot: Slot; name: string; spec: string; // spec: "Air fork · 120 mm"
  price: number; stock?: true; // exactly one stock part per bike per slot
  ride: Partial<Record<TuneKey, number>>; // ADDED to the bike's base value
  spin?: number; headAngle?: number; weight?: number; // added to the BikeSpec spin, the sheet's head angle (deg), kg
  does: string; // one kid sentence
}

// Keys a part in each slot may touch (tires also reach `spin` through PartDef.spin).
export const SLOT_KEYS: Record<Slot, TuneKey[]> = {
  suspension: ['wobbleKick', 'wobbleSpeed', 'plowSize', 'popSoak', 'flatKeep', 'rockCrash', 'minRadius', 'steerResponse'],
  tires: ['grip', 'bermGrip', 'looseLimit', 'looseDrag', 'rolling', 'rollUp', 'wobbleKick'],
  brakes: ['brake', 'skidDecel'],
  cockpit: ['wobbleSpeed', 'steerResponse', 'minRadius'],
  drivetrain: ['legs', 'energyCost', 'gearTop', 'gearBog', 'sprint', 'pedalAccel'],
};

const stock = (bike: LabBikeId, slot: Slot, name: string, spec: string, does: string): PartDef =>
  ({ id: `${bike}-${slot}-stock`, bike, slot, name, spec, price: 0, stock: true, ride: {}, does });

export const PARTS: PartDef[] = [
  // Hand-me-down Hardtail: every slot is a tired original, each with one upgrade
  stock('hardtail', 'suspension', 'Rigid fork', 'Steel fork · no travel', 'Rattles on rough ground'),
  { id: 'hardtail-air-fork', bike: 'hardtail', slot: 'suspension', name: 'Air fork', spec: 'Air fork · 120 mm', price: 55, weight: 0.4, headAngle: -1,
    ride: { wobbleKick: -0.3, wobbleSpeed: 2, rockCrash: 1.5, minRadius: 0.1, steerResponse: -0.5 }, does: 'Kicks less, wobbles later and takes rock hits better, turns a touch wider' },
  stock('hardtail', 'tires', 'Worn tires', 'Knobbies · 2.1 in', 'Slides on loose ground'),
  { id: 'hardtail-sticky-tires', bike: 'hardtail', slot: 'tires', name: 'Sticky tires', spec: 'Sticky rubber · 2.4 in', price: 45, weight: 0.3,
    ride: { grip: 1.5, bermGrip: 0.3, looseLimit: 0.1, rolling: 0.05 }, does: 'Grip harder in turns, berms and gravel, a bit slower to roll' },
  { id: 'hardtail-fast-tires', bike: 'hardtail', slot: 'tires', name: 'Fast tires', spec: 'Light knobbies · 2.0 in', price: 45, spin: 0.2, weight: -0.4,
    ride: { rolling: -0.03, grip: -1 }, does: 'Roll faster and spin quicker in the air, but slide more' },
  stock('hardtail', 'brakes', 'Rim brakes', 'Cable rim brakes', 'Stops, eventually'),
  { id: 'hardtail-hydraulic-brakes', bike: 'hardtail', slot: 'brakes', name: 'Hydraulic brakes', spec: 'Hydraulic disc · 160 mm', price: 50, weight: 0.1,
    ride: { brake: 4 }, does: 'Stop much harder' },
  stock('hardtail', 'cockpit', 'Skinny bars', 'Flat bar · 680 mm', 'Twitchy and narrow'),
  { id: 'hardtail-wide-bars', bike: 'hardtail', slot: 'cockpit', name: 'Wide bars', spec: 'Riser bar · 760 mm', price: 45,
    ride: { wobbleSpeed: 2, steerResponse: -2 }, does: 'Steadier at speed, slower to flick round' },
  stock('hardtail', 'drivetrain', '3 x 7 gears', '3 x 7 speed', 'Plenty of gears, none of them good'),
  { id: 'hardtail-1x11', bike: 'hardtail', slot: 'drivetrain', name: '1 x 11 gears', spec: '1 x 11 speed', price: 50, weight: -0.5,
    ride: { legs: 0.15, energyCost: -0.05 }, does: 'Easier to climb and less tiring' },

  // Orange Dirt Jumper: one gear, small wheels
  stock('dirtjumper', 'suspension', 'Rigid fork', 'Steel fork · no travel', 'Stiff and snappy'),
  stock('dirtjumper', 'tires', 'Park tires', 'Knobbies · 2.3 in', 'Grippy enough for dirt'),
  { id: 'dirtjumper-fast-tires', bike: 'dirtjumper', slot: 'tires', name: 'Fast tires', spec: 'Slick-ish · 2.0 in', price: 50, weight: -0.2,
    ride: { rolling: -0.05, grip: -0.8 }, does: 'Roll faster but slide more' },
  stock('dirtjumper', 'brakes', 'Rear brake', 'Rear disc only', 'Just a back brake'),
  stock('dirtjumper', 'cockpit', 'Riser bars', 'Riser bar · 780 mm', 'Tall bars for flicking round'),
  stock('dirtjumper', 'drivetrain', 'Single speed', '1 speed · 25/11', 'One gear for everything'),
  { id: 'dirtjumper-big-gear', bike: 'dirtjumper', slot: 'drivetrain', name: 'Big gear', spec: 'Single speed · 28/11', price: 50,
    ride: { gearTop: 1.5, pedalAccel: -0.6, gearBog: 0.2 }, does: 'Faster top speed, slower to get going and up steep bits' },
  { id: 'dirtjumper-small-gear', bike: 'dirtjumper', slot: 'drivetrain', name: 'Small gear', spec: 'Single speed · 22/11', price: 50,
    ride: { gearTop: -1, pedalAccel: 0.8, gearBog: -0.15 }, does: 'Quick to get going and up steep bits, tops out sooner' },

  // Teal Enduro: plush, heavy, big brakes
  stock('enduro', 'suspension', 'Stock shock', 'Air shock · 170 mm', 'Soft and even'),
  { id: 'enduro-coil-shock', bike: 'enduro', slot: 'suspension', name: 'Coil shock', spec: 'Coil shock · 170 mm', price: 80, weight: 0.6,
    ride: { plowSize: 0.1, popSoak: 0.15 }, does: 'Plows through rocks, but soaks up your pop' },
  { id: 'enduro-air-shock', bike: 'enduro', slot: 'suspension', name: 'Air shock', spec: 'Tuned air shock · 170 mm', price: 80, weight: -0.3,
    ride: { popSoak: -0.2, plowSize: -0.1 }, does: 'Pops better off jumps, plows rocks less' },
  stock('enduro', 'tires', 'Trail tires', 'Knobbies · 2.5 in', 'Big and grippy'),
  { id: 'enduro-light-wheels', bike: 'enduro', slot: 'tires', name: 'Light wheels', spec: 'Light carbon wheels · 29 in', price: 90, spin: 0.15, weight: -0.8,
    ride: { rolling: -0.03, wobbleKick: 0.1 }, does: 'Spin quicker in the air, a bit bouncier' },
  stock('enduro', 'brakes', '2-piston brakes', '2-piston disc · 180 mm', 'Good stopping power'),
  { id: 'enduro-4-piston-brakes', bike: 'enduro', slot: 'brakes', name: '4-piston brakes', spec: '4-piston disc · 203 mm', price: 70, weight: 0.2,
    ride: { brake: 6, skidDecel: 1.5 }, does: 'Stop super hard, but they grab and skid' },
  stock('enduro', 'cockpit', 'Wide bars', 'Riser bar · 800 mm', 'Wide and calm'),
  stock('enduro', 'drivetrain', '1 x 12 gears', '1 x 12 speed', 'Wide range for long climbs'),

  // Tan Bolinas Ridge: the all-rounder
  stock('bolinas', 'suspension', 'Trail fork', 'Air fork · 130 mm', 'Does a bit of everything'),
  { id: 'bolinas-long-fork', bike: 'bolinas', slot: 'suspension', name: 'Long fork', spec: 'Air fork · 140 mm', price: 70, weight: 0.2, headAngle: -1,
    ride: { wobbleSpeed: 2, rockCrash: 0.5, minRadius: 0.15, steerResponse: -0.7 }, does: 'Steadier and rolls over bigger things, turns a bit wider' },
  { id: 'bolinas-short-fork', bike: 'bolinas', slot: 'suspension', name: 'Short fork', spec: 'Air fork · 120 mm', price: 70, weight: -0.2, headAngle: 1,
    ride: { wobbleSpeed: -2, rockCrash: -0.5, minRadius: -0.15, steerResponse: 0.7 }, does: 'Quicker to turn, wobbles sooner at speed' },
  stock('bolinas', 'tires', 'Trail tires', 'Knobbies · 2.35 in', 'Good all round'),
  { id: 'bolinas-sticky-tires', bike: 'bolinas', slot: 'tires', name: 'Sticky tires', spec: 'Sticky rubber · 2.4 in', price: 50, weight: 0.3,
    ride: { grip: 1.5, bermGrip: 0.3, looseLimit: 0.1, rolling: 0.05 }, does: 'Grip harder in turns, berms and gravel, a bit slower to roll' },
  stock('bolinas', 'brakes', 'Trail brakes', '2-piston disc · 180 mm', 'Reliable stopping'),
  stock('bolinas', 'cockpit', 'Trail bars', 'Riser bar · 780 mm', 'Comfortable and balanced'),
  stock('bolinas', 'drivetrain', '1 x 11 gears', '1 x 11 speed', 'Strong legs for climbing'),
];

export interface BikeSheet { type: string; price: number; wheels: string; headAngle: number; wheelbase: number; reach: number; weight: number }

// Bike prices (cogs; tests/pacing.test.ts): the hardtail is everyone's starter; the first new bike takes most of the
// area's 2-star clears, and costs well over five of the dearest part. A rider who buys all six hardtail parts (290)
// has 555 left from the 1- and 2-star clears of the 13 challenges the hardtail can start: a few 3-stars short of the
// Dirt Jumper (600), so the last part or two is a real choice against saving for a bike.
export const SHEETS: Record<LabBikeId, BikeSheet> = {
  hardtail: { type: 'Hardtail', price: 0, wheels: '27.5"', headAngle: 68, wheelbase: 1130, reach: 420, weight: 15.5 },
  bolinas: { type: 'Trail bike', price: 650, wheels: '29"', headAngle: 66.5, wheelbase: 1180, reach: 450, weight: 13.1 },
  dirtjumper: { type: 'Dirt Jumper', price: 600, wheels: '26"', headAngle: 69, wheelbase: 1050, reach: 400, weight: 12 },
  enduro: { type: 'Enduro', price: 700, wheels: '29"', headAngle: 64, wheelbase: 1260, reach: 480, weight: 15 },
};

export type Fitted = Record<Slot, string>; // part id per slot

export interface Loadout { bike: LabBikeId; spec: BikeSpec; tune: Record<TuneKey, number>; sheet: BikeSheet; fitted: Fitted }

export function partsFor(bike: LabBikeId, slot?: Slot): PartDef[] {
  return PARTS.filter((p) => p.bike === bike && (!slot || p.slot === slot));
}

export function stockFitted(bike: LabBikeId): Fitted {
  return Object.fromEntries(SLOTS.map((s) => [s, partsFor(bike, s).find((p) => p.stock)!.id])) as Fitted;
}

// Unknown ids, and parts that belong to another bike or slot, fit as the stock part.
export function loadout(bike: LabBikeId, fitted: Partial<Fitted>, color?: number): Loadout {
  const stocks = stockFitted(bike);
  const ids = {} as Fitted;
  const tune = { ...DEFAULTS, ...BIKE_RIDE[bike] };
  const spec: BikeSpec = { ...LAB_BIKES[bike] }; // a copy: LAB_BIKES is never mutated
  const sheet: BikeSheet = { ...SHEETS[bike] };
  for (const s of SLOTS) {
    const p = partsFor(bike, s).find((x) => x.id === fitted[s]) ?? partsFor(bike, s).find((x) => x.id === stocks[s])!;
    ids[s] = p.id;
    for (const [k, v] of Object.entries(p.ride) as [TuneKey, number][]) tune[k] += v;
    spec.spin += p.spin ?? 0;
    sheet.headAngle += p.headAngle ?? 0;
    sheet.weight += p.weight ?? 0;
  }
  if (color !== undefined) spec.frameColor = color;
  return { bike, spec, tune, sheet, fitted: ids };
}

// Every key a bike or a part can touch is rewritten, so swapping loadouts never leaves a stale value behind.
const WRITTEN: TuneKey[] = [...new Set([...RIDE_KEYS, ...Object.values(SLOT_KEYS).flat()])];
export function applyLoadout(l: Loadout, t: Record<TuneKey, number> = T): void {
  for (const k of WRITTEN) t[k] = l.tune[k];
}
