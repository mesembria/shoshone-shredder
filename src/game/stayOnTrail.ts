// Stay on the trail: "Cut it and you crash, back where you left it." On a timed run the game follows how far along the
// run's route (src/world/route.ts) the rider has got, step by step. Leaving the route for ROUTE.off metres of riding, or
// coming back onto it more than ROUTE.skip metres past the furthest point reached, is a cut; the caller crashes the bike
// (crashBack) to get up at the furthest point. The game (src/game/main.ts) and the robots call the same routeTick.
// Nothing here allocates per step, except the get-up spot when progress has moved since it was last asked for.
import * as THREE from 'three';
import { inZone } from '../world/trail';
import { locate, routeLength, routePoint, ROUTE, type Route } from '../world/route';
import type { LabState } from '../lab/bike';

export interface RouteTrack {
  route: Route;
  furthest: number; // route metres: the furthest point reached
  offRidden: number; // metres ridden since leaving the route
  topped: boolean; // the ↕ runs: the top has been reached
  spot: { pos: THREE.Vector3; yaw: number } | null; // the get-up spot at `furthest`, kept until progress moves
  spotFor: number; // the progress `spot` was worked out for
  length: number;
  call: RouteCall; // the one answer handed back each step, reset every time
}
export interface RouteCall { finish?: true; top?: true; cut?: true; at?: { pos: THREE.Vector3; yaw: number } }

export function startTrack(route: Route): RouteTrack {
  return { route, furthest: 0, offRidden: 0, topped: false, spot: null, spotFor: -1, length: routeLength(route), call: {} };
}

// On the trail where you'd got to, facing along it.
function spotOf(t: RouteTrack): { pos: THREE.Vector3; yaw: number } {
  if (!t.spot || t.spotFor !== t.furthest) {
    t.spot = routePoint(t.route, t.furthest);
    t.spotFor = t.furthest;
  }
  return t.spot;
}
function cut(t: RouteTrack, c: RouteCall): RouteCall {
  t.offRidden = 0;
  c.cut = true;
  c.at = spotOf(t);
  return c;
}

// Judge one step (prev: where the bike was before it; finishCrossed: it crossed the finish line this step). It never
// crashes anything itself: a cut comes back as { cut, at } for the caller.
export function routeTick(t: RouteTrack, s: LabState, prev: { x: number; z: number }, finishCrossed: boolean): RouteCall {
  const c = t.call;
  c.finish = c.top = c.cut = c.at = undefined;
  const nearEnd = t.length - t.furthest <= ROUTE.skip;
  // tumbling: nothing is judged; a tumble that ends off the route, or far ahead on it, gets up where you'd got to
  if (s.crash) {
    const d = locate(t.route, s.pos.x, s.pos.z, s.yaw, t.furthest);
    s.getUpAt = d === null || d > t.furthest + ROUTE.skip ? spotOf(t) : null;
    if (finishCrossed && nearEnd) c.finish = true;
    return c;
  }
  const d = locate(t.route, s.pos.x, s.pos.z, s.yaw, t.furthest);
  if (d !== null) {
    if (d > t.furthest + ROUTE.skip) return cut(t, c);
    t.furthest = Math.max(t.furthest, d);
    t.offRidden = 0;
    if (t.route.top !== undefined && !t.topped && t.furthest >= t.route.top) {
      t.topped = true;
      c.top = true;
    }
  } else if (t.route.also?.some((z) => inZone(z, s.pos.x, s.pos.z))) {
    t.offRidden = 0; // off the trail but on ground that counts (Hairpin's turnaround): no progress, no cut
  } else {
    const step = Math.hypot(s.pos.x - prev.x, s.pos.z - prev.z);
    if (step <= ROUTE.jump) t.offRidden += step; // a teleport isn't riding
    if (t.offRidden >= ROUTE.off) return cut(t, c);
  }
  if (finishCrossed) {
    if (t.length - t.furthest > ROUTE.skip) return cut(t, c);
    c.finish = true;
  }
  return c;
}

// For the how-close text: route metres from the furthest point to the top (the ↕ runs, before it), else to the finish.
export function metresLeft(t: RouteTrack): { m: number; to: 'top' | 'finish' } {
  const top = t.route.top;
  return top !== undefined && !t.topped ? { m: top - t.furthest, to: 'top' } : { m: t.length - t.furthest, to: 'finish' };
}
