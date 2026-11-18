import type { BikeSpec } from './bikes';

export const RIDE = { accel: 6, brake: 10, coastDrag: 0.6, turnBase: 2.4, turnFalloff: 0.15 };

// throttle: -1 (brake) .. 0 (auto-pedal) .. 1 (push for top speed). pedal: 1 normally, lower when Winded.
export function nextSpeed(speed: number, throttle: number, dt: number, bike: BikeSpec, onGrass: boolean, pedal = 1): number {
  if (throttle < 0) return Math.max(0, speed - RIDE.brake * -throttle * dt);
  const target = (bike.cruise + (bike.topSpeed - bike.cruise) * throttle) * pedal * (onGrass ? bike.grassFactor : 1);
  return speed < target ? Math.min(target, speed + RIDE.accel * pedal * dt) : Math.max(target, speed - RIDE.coastDrag * dt);
}

// Radians per second at full steer. Slower bikes turn tighter.
export function turnRate(speed: number): number {
  return RIDE.turnBase / (1 + RIDE.turnFalloff * speed);
}

// Skid: brake hard and steer hard at speed, and the rear wheel slides out. The bike turns much
// sharper and sheds speed more slowly than a plain brake. Loose ground (grass, dirt) slides easier.
export const SKID = { minSpeed: 2.5, brakeAt: -0.4, steerAt: 0.5, decel: 4.5, loose: 1.25 };

export function isSkidding(speed: number, throttle: number, steer: number): boolean {
  return speed > SKID.minSpeed && throttle <= SKID.brakeAt && Math.abs(steer) >= SKID.steerAt;
}

export function skidTurnRate(speed: number, bike: BikeSpec, loose: boolean): number {
  return turnRate(speed) * bike.skid * (loose ? SKID.loose : 1);
}
