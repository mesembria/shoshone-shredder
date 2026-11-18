// The robots' steering on curved trails: aim at a point and turn toward it, the way every robot always has (three
// times the heading error, held to full lock).
import type { Trail } from '../src/world/trail';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// the steer in [-1, 1] that turns a bike at (x, z) heading yaw toward (tx, tz)
export function steerToward(x: number, z: number, yaw: number, tx: number, tz: number): number {
  const err = wrap(Math.atan2(-(tz - z), tx - x) - yaw);
  return Math.max(-1, Math.min(1, -err * 3));
}

// the steer toward the trail's centreline `ahead` metres further along it than where the bike is
export function pathSteer(t: Trail, x: number, z: number, yaw: number, ahead = 3): number {
  const p = t.path.at(Math.min(t.path.length, t.path.nearest(x, z).u + ahead));
  return steerToward(x, z, yaw, p.x, p.z);
}

// the trail's centreline carried on straight past its end, so a robot aiming ahead at the bottom keeps going
export function pastEnd(t: Trail, u: number): { x: number; z: number } {
  const L = t.path.length, p = t.path.at(Math.min(u, L)), over = Math.max(0, u - L);
  return { x: p.x + over * Math.cos(p.yaw), z: p.z - over * Math.sin(p.yaw) };
}
