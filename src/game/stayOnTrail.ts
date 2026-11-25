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
  offFrom: { x: number; z: number }; // where the last stride of that ended (one object, reused)
  offFromSet: boolean; // offFrom holds a place: riding off the route has begun
  topped: boolean; // the ↕ runs: the top has been reached
  spot: { pos: THREE.Vector3; yaw: number } | null; // the get-up spot at `furthest`, kept until progress moves
  spotFor: number; // the progress `spot` was worked out for
  scratch: { pos: THREE.Vector3; yaw: number; half: number }; // for a look at a point that isn't kept
  length: number;
  call: RouteCall; // the one answer handed back each step, reset every time
}
export interface RouteCall { finish?: true; top?: true; cut?: true; at?: { pos: THREE.Vector3; yaw: number } }

export function startTrack(route: Route): RouteTrack {
  return { route, furthest: 0, offRidden: 0, offFrom: { x: 0, z: 0 }, offFromSet: false, topped: false, spot: null, spotFor: -1, scratch: { pos: new THREE.Vector3(), yaw: 0, half: 0 }, length: routeLength(route), call: {} };
}

// On the trail where you'd got to, facing along it.
function spotOf(t: RouteTrack): { pos: THREE.Vector3; yaw: number } {
  if (!t.spot || t.spotFor !== t.furthest) {
    t.spot = routePoint(t.route, t.furthest);
    t.spotFor = t.furthest;
  }
  return t.spot;
}
// riding off the route is counted in strides of this many metres: a bike pinned in a bush, shaking a few mm a step while
// the rider pushes, never finishes one, so being stuck isn't riding; a ridden line measures the same as step by step
const STRIDE = 0.25;
function backOn(t: RouteTrack): void {
  t.offRidden = 0;
  t.offFromSet = false;
}
function cut(t: RouteTrack, c: RouteCall): RouteCall {
  backOn(t);
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
  // tumbling: nothing is judged; a tumble that ends off the dirt (in the grass band too: near a switchback that can be
  // within reach of the leg below, and riding onto it would be a cut), or far ahead on the route, gets up where you'd
  // got to
  if (s.crash) {
    const d = locate(t.route, s.pos.x, s.pos.z, s.yaw, t.furthest);
    // on the dirt where the route reads it: beside a switchback, one leg's grass band overlaps the next leg's dirt
    const p = d === null ? null : routePoint(t.route, d, t.scratch);
    const onDirt = !!p && Math.hypot(p.pos.x - s.pos.x, p.pos.z - s.pos.z) <= p.half + 0.05;
    // or on ground that counts (Hairpin's turnaround): there a tumble gets up where it ends, as riding there counts
    const onAlso = d === null && !!t.route.also?.some((z) => inZone(z, s.pos.x, s.pos.z));
    s.getUpAt = onAlso ? null : !onDirt || d! > t.furthest + ROUTE.skip ? spotOf(t) : null;
    if (finishCrossed && nearEnd) c.finish = true;
    return c;
  }
  const d = locate(t.route, s.pos.x, s.pos.z, s.yaw, t.furthest);
  if (d !== null) {
    if (d > t.furthest + ROUTE.skip) return cut(t, c);
    t.furthest = Math.max(t.furthest, d);
    backOn(t);
    if (t.route.top !== undefined && !t.topped && t.furthest >= t.route.top) {
      t.topped = true;
      c.top = true;
    }
  } else if (t.route.also?.some((z) => inZone(z, s.pos.x, s.pos.z))) {
    backOn(t); // off the trail but on ground that counts (Hairpin's turnaround): no progress, no cut
  } else {
    const from = t.offFrom;
    if (!t.offFromSet) {
      from.x = prev.x;
      from.z = prev.z;
      t.offFromSet = true;
    }
    const stride = Math.hypot(s.pos.x - from.x, s.pos.z - from.z);
    if (stride >= STRIDE) {
      if (stride <= ROUTE.jump) t.offRidden += stride; // a teleport isn't riding
      from.x = s.pos.x;
      from.z = s.pos.z;
    }
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
