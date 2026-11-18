// Speed wobble: every bike has a speed where it gets scary. Above it steering gets touchier instead of calmer, bumps
// knock the heading sideways, and swinging side to side builds a hidden level that wipes you out at T.wobbleLimit.
// Braking drains it fast; a still thumb drains it slowly. The bike sets where it starts (wobbleSpeed) and how hard
// bumps kick (wobbleKick); parts will move both later.
import { T, type TuneKey } from './tune';

type Tune = Record<TuneKey, number>;
const KICK = 0.25; // radians of heading a full-size bump gives at full wobble and kick 1
const BUILD = 0.33; // level per (rad/s² of steering swing × over) per second
const DRAIN_FAST = 2.4, DRAIN_STEADY = 0.6; // level per second

// 0 at or below the wobble speed, 1 at the bike's top speed from hills.
export function wobbleOver(speed: number, t: Tune = T): number {
  if (t.wobbleSpeed <= 0 || speed <= t.wobbleSpeed) return 0;
  return Math.min(1, (speed - t.wobbleSpeed) / Math.max(0.5, t.maxSpeed - t.wobbleSpeed));
}

export function steerGain(over: number, t: Tune = T): number {
  return 1 + t.wobbleGain * over;
}

// A signed heading kick. size: 1 for a landing or a rock bonk, smaller per step on rough ground. phase comes from
// the clock and position, so the same ride kicks the same way every time.
export function bumpKick(over: number, size: number, phase: number, t: Tune = T): number {
  if (over <= 0 || size <= 0) return 0;
  const side = Math.sin(phase * 7.7) >= 0 ? 1 : -1;
  const amount = 0.5 + 0.5 * Math.abs(Math.sin(phase * 12.9898));
  return side * KICK * t.wobbleKick * over * size * amount;
}

export interface WobbleIn {
  over: number; // from wobbleOver
  yawJerk: number; // change of yaw rate, rad/s²
  braking: boolean;
  steady: boolean; // thumb held still near the middle
}
export function stepWobble(level: number, i: WobbleIn, dt: number, t: Tune = T): number {
  let next = level + Math.abs(i.yawJerk) * i.over * BUILD * dt;
  if (i.braking || i.over === 0) next -= DRAIN_FAST * dt;
  else if (i.steady) next -= DRAIN_STEADY * dt;
  return Math.max(0, Math.min(t.wobbleLimit, next));
}
