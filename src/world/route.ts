// A timed run's route: the trail stretches it follows, in riding order. The game tracks how far along it the rider has
// got (src/game/stayOnTrail.ts), so leaving the trail to skip part of it can be caught where it happens.
import * as THREE from 'three';
import { trailPoint, type Trail, type TrailZone } from './trail';

// How far from the trail still counts as on it (past its half width), how many metres ridden off it make a cut, how far
// ahead of the furthest point reached coming back counts as a skip, what facing the wrong way costs a leg when choosing
// between two that overlap (the ↕ runs), and the step length above which a move is a teleport, not riding.
export const ROUTE = { lateral: 2, off: 10, skip: 10, heading: 3, jump: 3 };

// One stretch of trail, ridden from u0 to u1 (backward when u1 < u0).
export interface RouteLeg { trail: Trail; u0: number; u1: number }
// top: the route distance of the top on the ↕ runs. also: ground that counts as on the route but gives no progress
// (Hairpin's turnaround platform).
export interface Route { legs: RouteLeg[]; top?: number; also?: TrailZone[] }

const legLength = (l: RouteLeg) => Math.abs(l.u1 - l.u0);
export function routeLength(r: Route): number {
  let n = 0;
  for (const l of r.legs) n += legLength(l);
  return n;
}

// On the trail at route distance d (clamped to the route), 2 cm up, facing the way it's ridden.
export function routePoint(r: Route, d: number): { pos: THREE.Vector3; yaw: number } {
  let left = Math.max(0, Math.min(routeLength(r), d));
  for (let i = 0; i < r.legs.length; i++) {
    const l = r.legs[i], len = legLength(l);
    if (left <= len || i === r.legs.length - 1) {
      const back = l.u1 < l.u0, u = l.u0 + (back ? -1 : 1) * Math.min(left, len);
      return { pos: trailPoint(l.trail, u, 0, 0.02), yaw: l.trail.path.yawAt(u) + (back ? Math.PI : 0) };
    }
    left -= len;
  }
  throw new Error('a route needs a leg');
}

// Where along the route (x, z) is, or null when it's off it. Each leg offers up to two readings: the nearest point on its
// whole trail, and, on the stretch of it within ROUTE.skip + 5 m of `near` (the progress so far), the point within reach
// closest to `near`. The second
// matters where the trail doubles back: on the inside of a switchback the next leg can be as close as this one. Of the
// readings within reach, the one closest to `near` wins, and one ridden the other way from `yaw` counts ROUTE.heading
// metres further (the ↕ runs, where a trail is ridden up then back down). Nothing is allocated.
const WINDOW = 5;
let best = 0, bestScore = Infinity;
function consider(l: RouteLeg, start: number, u: number, off: number, dist: number, yaw: number, near: number): void {
  const lo = Math.min(l.u0, l.u1), hi = Math.max(l.u0, l.u1);
  // a hair past a leg's end (rounding at its first and last point) still counts, at the end; but past the end of the
  // trail itself the nearest point is its last one, and that's not beside it (Goat Ladder's climb ends where the descent
  // starts)
  const ends = u <= 1e-6 || u >= l.trail.path.length - 1e-6;
  if (u < lo - 0.05 || u > hi + 0.05 || dist > l.trail.width / 2 + ROUTE.lateral || (ends && dist > Math.abs(off) + 0.05)) return;
  const uc = Math.max(lo, Math.min(hi, u)), d = start + Math.abs(uc - l.u0), back = l.u1 < l.u0;
  const along = l.trail.path.yawAt(uc) + (back ? Math.PI : 0);
  const score = Math.abs(d - near) + (Math.cos(yaw - along) < 0 ? ROUTE.heading : 0);
  if (score < bestScore) {
    bestScore = score;
    best = d;
  }
}
export function locate(r: Route, x: number, z: number, yaw: number, near: number): number | null {
  best = 0;
  bestScore = Infinity;
  let start = 0;
  for (const l of r.legs) {
    const len = legLength(l), back = l.u1 < l.u0, dir = back ? -1 : 1;
    const g = l.trail.path.probe(x, z);
    consider(l, start, g.u, g.off, g.dist, yaw, near);
    // the stretch of this leg around `near` (clamped to the leg)
    const a = Math.max(0, Math.min(len, near - start - ROUTE.skip - WINDOW)), b = Math.max(0, Math.min(len, near - start + ROUTE.skip + WINDOW));
    if (b > a) {
      const uNear = l.u0 + dir * Math.max(0, Math.min(len, near - start));
      const p = l.trail.path.probeNear(x, z, l.u0 + dir * a, l.u0 + dir * b, l.trail.width / 2 + ROUTE.lateral, uNear);
      if (p.dist < Infinity) consider(l, start, p.u, p.off, p.dist, yaw, near);
    }
    start += len;
  }
  return bestScore < Infinity ? best : null;
}
