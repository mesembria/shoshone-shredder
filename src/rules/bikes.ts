export type BikeId = 'bolinas' | 'bayview';

// A bike's shape, in model units: the rig is modeled for a 0.36 m wheel, then scaled by the rider scale. Points are
// (x, y) in the bike's side view, x forward, y up from the ground.
export interface FrameShape {
  axle: number; // half the wheelbase
  bb: [number, number]; // bottom bracket
  seat: [number, number];
  htTop: [number, number]; // head tube top
  htBottom: [number, number]; // head tube bottom
  bar: [number, number]; // stem top, where the hands go
  barHalf: number; // half the bar width
}

// What a bike's fork, rear end and brakes are: the look and the ride (bottoming out) both read it. Parts patch it.
export type SpringKind = 'air' | 'coil';
export type RearDesign = 'singlePivot' | 'linkage' | 'shortLink';
export type Brake = 'none' | 'rim' | number; // a number is a disc rotor, mm
export interface Kit {
  fork: { kind: 'rigid' | SpringKind; travel: number }; // mm, 0 when rigid
  rear: { design: 'hardtail' | RearDesign; shock: SpringKind; travel: number }; // travel 0 on a hardtail
  brakeFront: Brake;
  brakeRear: Brake;
}
export interface KitPatch { fork?: Kit['fork']; rear?: Partial<Kit['rear']>; brakeFront?: Brake; brakeRear?: Brake }
export const DEFAULT_KIT: Kit = { fork: { kind: 'rigid', travel: 0 }, rear: { design: 'hardtail', shock: 'air', travel: 0 }, brakeFront: 'none', brakeRear: 'none' };

export interface BikeSpec {
  id: string; // the game's BikeId for the trail bikes; lab-only bikes have their own
  name: string;
  frameColor: number;
  wheelRadius: number; // meters
  cruise: number; // auto-pedal speed, m/s
  topSpeed: number; // speed with the stick pushed up, m/s
  spin: number; // trick speed multiplier
  grassFactor: number; // share of speed kept on grass
  skid: number; // how much sharper the bike turns with the rear wheel skidding
  riderScale?: number; // whole-rig scale; by default the wheel size sets it, so a smaller bike gets a smaller rider
  frame?: Partial<FrameShape>; // by default, the trail bike shape
  kit?: Kit; // by default rigid, hardtail, no brakes (the phase-0 bikes)
}

export const kitOf = (spec: BikeSpec): Kit => spec.kit ?? DEFAULT_KIT;
export function withKit(kit: Kit, patch: KitPatch): Kit {
  return { ...kit, ...patch, fork: { ...(patch.fork ?? kit.fork) }, rear: { ...kit.rear, ...patch.rear } };
}

// The Bayview's smaller, lighter wheels break loose sooner, so it skids round tighter.
export const BIKES: Record<BikeId, BikeSpec> = {
  bolinas: { id: 'bolinas', name: 'Tan Bolinas Ridge', frameColor: 0xc8b48c, wheelRadius: 0.35, cruise: 7, topSpeed: 10.5, spin: 0.9, grassFactor: 0.78, skid: 2.2 },
  bayview: { id: 'bayview', name: 'Black Bayview Trail', frameColor: 0x26272b, wheelRadius: 0.31, cruise: 7, topSpeed: 9.5, spin: 1.15, grassFactor: 0.68, skid: 2.8 },
};
