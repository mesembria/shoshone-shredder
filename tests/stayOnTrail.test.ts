// Stay on the trail: progress along a timed run's route, and catching a cut (src/game/stayOnTrail.ts). No physics: the
// bike is moved by hand, the way a step would move it.
import { describe, it, expect } from 'vitest';
import { buildHill } from '../src/world/places/hill';
import { locate, routeLength, routePoint, ROUTE, type Route } from '../src/world/route';
import { startTrack, routeTick, metresLeft, type RouteTrack, type RouteCall } from '../src/game/stayOnTrail';
import { createLabState, type LabState } from '../src/lab/bike';
import { LAB_BIKES } from '../src/lab/bikes';
import { trailPoint } from '../src/world/trail';

const hill = buildHill();
const route = (id: string): Route => hill.runs[id].route;
const STEP = 0.25;

// a rider on a route: move them to (x, z) facing yaw, and judge the step
function rider(r: Route) {
  const p0 = routePoint(r, 0);
  const s: LabState = createLabState(LAB_BIKES.bolinas, p0.pos.clone(), p0.yaw);
  const t: RouteTrack = startTrack(r);
  const prev = { x: s.pos.x, z: s.pos.z };
  const calls: RouteCall[] = [];
  const to = (x: number, z: number, yaw: number, finish = false): RouteCall => {
    prev.x = s.pos.x;
    prev.z = s.pos.z;
    s.pos.set(x, s.pos.y, z);
    s.yaw = yaw;
    const c = { ...routeTick(t, s, prev, finish) };
    calls.push(c);
    return c;
  };
  const toRoute = (d: number, finish = false) => {
    const p = routePoint(r, d);
    return to(p.pos.x, p.pos.z, p.yaw, finish);
  };
  // put the rider at d with that much progress, without judging the way there
  const jumpTo = (d: number) => {
    const p = routePoint(r, d);
    s.pos.copy(p.pos);
    s.yaw = p.yaw;
    t.furthest = d;
  };
  return { s, t, to, toRoute, jumpTo, calls };
}
const sideways = (r: Route, d: number, off: number) => {
  const p = routePoint(r, d);
  return { x: p.pos.x + off * Math.sin(p.yaw), z: p.pos.z + off * Math.cos(p.yaw), yaw: p.yaw };
};
// which side of the route at d a rider can head straight out for `far` metres without meeting the route again
function clearSide(r: Route, d: number, far: number): number {
  const w = r.legs[0].trail.width / 2 + ROUTE.lateral;
  for (const side of [1, -1]) {
    let ok = true;
    for (let o = w + 0.5; o <= far; o += 0.25) {
      const q = sideways(r, d, side * o);
      if (locate(r, q.x, q.z, q.yaw, d) !== null) ok = false;
    }
    if (ok) return side;
  }
  throw new Error('no clear side');
}

describe('stay on the trail', () => {
  it('riding the whole route never cuts, and reaches its end', () => {
    for (const id of Object.keys(hill.runs)) {
      const r = route(id), len = routeLength(r), m = rider(r);
      for (let d = STEP; d < len; d += STEP) m.toRoute(d);
      const last = m.toRoute(len, true);
      expect(m.calls.some((c) => c.cut), id).toBe(false);
      expect(m.t.furthest, id).toBeGreaterThan(len - 0.6);
      expect(last.finish, id).toBe(true);
      expect(m.calls.filter((c) => c.top).length, id).toBe(r.top !== undefined ? 1 : 0);
    }
  });

  it('riding the grass band beside the trail never cuts', () => {
    const r = route('hairpinDown'), len = routeLength(r), off = r.legs[0].trail.width / 2 + 1.8;
    for (const side of [-1, 1]) {
      const m = rider(r);
      for (let d = STEP; d < len; d += STEP) {
        const q = sideways(r, d, side * off);
        m.to(q.x, q.z, q.yaw);
      }
      expect(m.calls.some((c) => c.cut), `side ${side}`).toBe(false);
    }
  });

  it('10 m ridden off the trail is a cut, 9.5 m is not', () => {
    const r = route('hairpinDown'), m = rider(r), side = clearSide(r, 30, 16);
    m.jumpTo(30);
    const leftAt = r.legs[0].trail.width / 2 + ROUTE.lateral;
    let cutAt: number | null = null, at: RouteCall['at'];
    for (let o = STEP; o <= 16 && cutAt === null; o += STEP) {
      const q = sideways(r, 30, side * o), c = m.to(q.x, q.z, q.yaw + side * Math.PI / 2);
      if (c.cut) {
        cutAt = o;
        at = c.at;
      }
    }
    expect(cutAt).not.toBeNull();
    // off the route from just past leftAt: the cut comes 10 m on, not 9.5
    expect(cutAt! - leftAt).toBeGreaterThan(9.5);
    expect(cutAt! - leftAt).toBeLessThan(10.5);
    expect(at!.pos.distanceTo(routePoint(r, 30).pos)).toBeLessThan(0.1);
  });

  it('pinned off the trail, jittering in place, is not riding', () => {
    // a bike stuck in a bush past the grass band shakes a few mm a step while the rider pushes: no cut, however long
    const r = route('hairpinDown'), m = rider(r), side = clearSide(r, 30, 6);
    m.jumpTo(30);
    const leftAt = r.legs[0].trail.width / 2 + ROUTE.lateral;
    for (let o = STEP; o <= leftAt + 1; o += STEP) {
      const q = sideways(r, 30, side * o);
      m.to(q.x, q.z, q.yaw);
    }
    const q = sideways(r, 30, side * (leftAt + 1));
    for (let i = 0; i < 60 * 30; i++) m.to(q.x + (i % 2 ? 0.04 : -0.04), q.z + (i % 3 ? 0.03 : -0.03), q.yaw);
    expect(m.calls.some((c) => c.cut)).toBe(false);
    expect(m.t.offRidden).toBeLessThan(2);
  });

  it('coming back more than the skip ahead is a cut', () => {
    const r = route('hairpinDown'), len = routeLength(r);
    // a switchback: two points 15 m apart along the route but only a few metres apart across the grass
    let d1 = -1;
    for (let d = 5; d < len - 20 && d1 < 0; d += 0.5) if (routePoint(r, d).pos.distanceTo(routePoint(r, d + 15).pos) < 6) d1 = d;
    expect(d1).toBeGreaterThan(0);
    const across = (ahead: number) => {
      const m = rider(r), a = routePoint(r, d1).pos, b = routePoint(r, d1 + ahead), yaw = b.yaw;
      m.jumpTo(d1);
      const n = Math.ceil(a.distanceTo(b.pos) / STEP);
      for (let i = 1; i <= n; i++) m.to(a.x + ((b.pos.x - a.x) * i) / n, a.z + ((b.pos.z - a.z) * i) / n, yaw);
      return m;
    };
    const cut = across(15);
    expect(cut.calls.some((c) => c.cut)).toBe(true);
    expect(cut.t.furthest).toBeLessThan(d1 + 10);
    const fine = across(8);
    expect(fine.calls.some((c) => c.cut)).toBe(false);
    expect(fine.t.furthest).toBeCloseTo(d1 + 8, 0);
  });

  it('the finish counts only from near the end', () => {
    const r = route('hairpinDown'), len = routeLength(r);
    const far = rider(r);
    far.jumpTo(len - 30);
    expect(far.toRoute(len - 30, true).cut).toBe(true);
    const near = rider(r);
    near.jumpTo(len - 5);
    expect(near.toRoute(len - 5, true).finish).toBe(true);
    // tumbling across it: never a cut, and the finish only from near the end
    const tumbleFar = rider(r);
    tumbleFar.jumpTo(len - 30);
    tumbleFar.s.crash = { outcome: 'wipeout', t: 0 };
    const c1 = tumbleFar.toRoute(len - 30, true);
    expect(c1.cut || c1.finish).toBeFalsy();
    const tumbleNear = rider(r);
    tumbleNear.jumpTo(len - 5);
    tumbleNear.s.crash = { outcome: 'wipeout', t: 0 };
    expect(tumbleNear.toRoute(len - 5, true).finish).toBe(true);
  });

  it('Hairpin ↕: the top platform turnaround is on the route', () => {
    const r = route('hairpinBoth'), top = r.top!, m = rider(r), hpt = r.legs[0].trail, plat = hill.trails.hairpinTop;
    const along = (t: typeof hpt, u0: number, u1: number) => {
      const dir = Math.sign(u1 - u0);
      for (let u = u0; dir * (u1 - u) > 0; u += dir * STEP) {
        const p = trailPoint(t, u);
        m.to(p.x, p.z, t.path.at(u).yaw + (dir < 0 ? Math.PI : 0));
      }
    };
    for (let d = STEP; d <= top; d += STEP) m.toRoute(d);
    along(hpt, r.legs[0].u1, hpt.path.length);
    along(plat, 0, plat.path.length);
    along(plat, plat.path.length, 0);
    along(hpt, hpt.path.length, r.legs[0].u1);
    for (let d = top; d <= top + 20; d += STEP) m.toRoute(d);
    expect(m.calls.some((c) => c.cut)).toBe(false);
    expect(m.t.furthest).toBeGreaterThan(top + 19);
  });

  it("a crash that tumbles off the route gets up where you'd got to", () => {
    const r = route('hairpinDown'), m = rider(r), side = clearSide(r, 30, 9);
    m.jumpTo(30);
    m.s.crash = { outcome: 'wipeout', t: 0 };
    const q = sideways(r, 30, side * 8);
    m.to(q.x, q.z, q.yaw);
    expect(m.s.getUpAt!.pos.distanceTo(routePoint(r, 30).pos)).toBeLessThan(0.1);
    m.toRoute(28);
    expect(m.s.getUpAt).toBeNull();
  });

  it('a tumble that ends on the grass between two legs gets up on the trail where you had got to', () => {
    // near a switchback the leg below is a few metres away across the grass: getting up there and riding onto it
    // would be a cut, a second crash for an honest one
    const r = route('hairpinDown'), len = routeLength(r), hpt = r.legs[0].trail;
    let d1 = -1;
    for (let d = 5; d < len - 20 && d1 < 0; d += 0.5) if (routePoint(r, d).pos.distanceTo(routePoint(r, d + 15).pos) < 6) d1 = d;
    expect(d1).toBeGreaterThan(0);
    for (const f of [0.4, 0.45, 0.5, 0.55, 0.6]) {
      const m = rider(r), a = routePoint(r, d1).pos, b = routePoint(r, d1 + 15).pos;
      const x = b.x + (a.x - b.x) * f, z = b.z + (a.z - b.z) * f;
      expect(hpt.path.probe(x, z).dist, `between the legs at ${f}`).toBeGreaterThan(hpt.width / 2); // on the grass
      m.jumpTo(d1);
      m.s.crash = { outcome: 'wipeout', t: 0 };
      m.to(x, z, routePoint(r, d1).yaw);
      expect(m.s.getUpAt, `at ${f}`).not.toBeNull();
      expect(m.s.getUpAt!.pos.distanceTo(routePoint(r, d1).pos), `at ${f}`).toBeLessThan(0.1);
    }
    // a tumble that ends on the dirt, on your own leg, gets up where it ends
    const m = rider(r);
    m.jumpTo(30);
    m.s.crash = { outcome: 'wipeout', t: 0 };
    m.toRoute(32);
    expect(m.s.getUpAt).toBeNull();
  });

  it('a teleport is not ridden', () => {
    const r = route('hairpinDown'), m = rider(r), side = clearSide(r, 30, 21);
    m.jumpTo(30);
    const q = sideways(r, 30, side * 20);
    expect(m.to(q.x, q.z, q.yaw).cut).toBeFalsy();
    expect(m.t.offRidden).toBe(0);
  });

  it('metresLeft counts route metres to the top, then the finish', () => {
    const r = route('hairpinBoth'), len = routeLength(r), m = rider(r);
    for (let d = STEP; d <= 10; d += STEP) m.toRoute(d);
    expect(metresLeft(m.t).to).toBe('top');
    expect(metresLeft(m.t).m).toBeCloseTo(r.top! - 10, 0);
    for (let d = 10; d <= r.top! + 5; d += STEP) m.toRoute(d);
    expect(metresLeft(m.t).to).toBe('finish');
    expect(metresLeft(m.t).m).toBeCloseTo(len - m.t.furthest, 5);
    const one = rider(route('hairpinDown'));
    one.toRoute(STEP);
    expect(metresLeft(one.t)).toEqual({ m: routeLength(route('hairpinDown')) - one.t.furthest, to: 'finish' });
  });
});

