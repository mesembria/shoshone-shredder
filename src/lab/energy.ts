// Energy: pushing hard costs it, a steady pace keeps it, coasting and stopping refill it. Load is what the legs are
// working, in units where T.energySteady breaks even. The bike changes the cost (energyCost), and a single-speed bike
// pays extra on steep pitches (gearBog) and keeps paying when it spins out above its gear (push still counts).
import { T, type TuneKey } from './tune';

type Tune = Record<TuneKey, number>;
export interface Effort {
  push: number; // 0..1: how far the stick is up
  pedaling: boolean; // false when coasting, braking, in the air or crashed
  slope: number; // radians, uphill positive
  speed: number; // m/s
  stopped: boolean; // standing still, foot down
}

export function energyLoad(e: Effort, t: Tune = T): number {
  if (!e.pedaling) return 0;
  const climb = Math.max(0, Math.sin(e.slope));
  const bog = t.gearBog * Math.max(0, climb - 0.08) * 10;
  // what the hill asks for. Without a push the legs only give their steady share (the climb code does the same), so
  // a steep pitch makes you slower, not more tired; pushing the stick up pays the hill in full
  const demand = e.push + 0.5 * t.steadyLegs + t.energyClimb * climb;
  const easy = Math.min(demand, t.steadyLegs);
  return t.energyCost * (easy + e.push * (demand - easy) + bog);
}

export function stepEnergy(energy: number, e: Effort, dt: number, t: Tune = T): number {
  if (t.energyTank <= 0) return 1;
  const load = energyLoad(e, t);
  let next: number;
  if (load > t.energySteady) {
    const flatExcess = Math.max(0.05, 1 + 0.5 * t.steadyLegs - t.energySteady); // a full sprint on the flat
    next = energy - ((load - t.energySteady) / (flatExcess * t.energyTank)) * dt;
  } else {
    // cruising on the flat counts as resting your legs; the closer a steady push gets to break-even, the slower it refills
    const cruise = t.energyCost * 0.5 * t.steadyLegs;
    const share = e.pedaling ? Math.min(1, (t.energySteady - load) / Math.max(0.01, t.energySteady - cruise)) : 1;
    next = energy + t.energyRefill * share * (e.stopped ? t.energyRest : 1) * dt;
  }
  return Math.max(0, Math.min(1, next));
}

// Pedal pickup left at this speed: a single gear runs out just below its top.
export function gearLimit(speed: number, t: Tune = T): number {
  if (t.gearTop <= 0) return 1;
  return Math.max(0, Math.min(1, t.gearTop - speed));
}
