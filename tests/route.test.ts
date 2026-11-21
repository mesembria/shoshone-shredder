// Each timed run's route: the trail stretches it follows, in riding order (src/world/route.ts)
import { describe, it, expect } from 'vitest';
import { buildHill } from '../src/world/places/hill';
import { locate, routeLength, routePoint, ROUTE, type Route } from '../src/world/route';
import type { Gate } from '../src/lab/course';

const hill = buildHill();
const mid = (g: Gate) => ({ x: (g.a.x + g.b.x) / 2, z: (g.a.y + g.b.y) / 2 });
const flat = (p: { x: number; z: number }, q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);
const ids = Object.keys(hill.runs);
const route = (id: string): Route => hill.runs[id].route;

describe('routes', () => {
  it('every timed run has a route from its start line to its finish line', () => {
    expect(ids.length).toBe(7);
    for (const id of ids) {
      const r = route(id);
      expect(flat(routePoint(r, 0).pos, mid(hill.runs[id].start)), `${id} start`).toBeLessThan(0.5);
      expect(flat(routePoint(r, routeLength(r)).pos, mid(hill.runs[id].finish)), `${id} finish`).toBeLessThan(0.5);
    }
  });

  it('riding a route down its middle reads steady progress', () => {
    for (const id of ids) {
      const r = route(id), len = routeLength(r);
      let last = 0;
      for (let d = 0; d <= len; d += 0.5) {
        const p = routePoint(r, d), got = locate(r, p.pos.x, p.pos.z, p.yaw, last);
        expect(got, `${id} at ${d}`).not.toBeNull();
        expect(Math.abs(got! - d), `${id} at ${d}`).toBeLessThan(0.6);
        last = got!;
      }
    }
  });

  it('counts the grass band but not past it', () => {
    const r = route('hairpinDown'), w = r.legs[0].trail.width / 2, p = routePoint(r, 30);
    for (const side of [-1, 1]) {
      const at = (off: number) => locate(r, p.pos.x + side * off * Math.sin(p.yaw), p.pos.z + side * off * Math.cos(p.yaw), p.yaw, 30);
      expect(at(w + ROUTE.lateral - 0.1), `side ${side} inside`).not.toBeNull();
      expect(at(w + ROUTE.lateral + 0.1), `side ${side} outside`).toBeNull();
    }
  });

  it('on the ↕ runs, which way you face picks the leg', () => {
    const r = route('hairpinBoth'), top = r.top!;
    const p = routePoint(r, top - 3), down = p.yaw + Math.PI;
    expect(Math.abs(locate(r, p.pos.x, p.pos.z, p.yaw, top - 3)! - (top - 3))).toBeLessThan(0.6);
    expect(Math.abs(locate(r, p.pos.x, p.pos.z, down, top)! - (top + 3))).toBeLessThan(0.6);
  });

  it("the ↕ runs' top is the ↑ run's finish", () => {
    for (const [both, up] of [['goatBoth', 'goatUp'], ['hairpinBoth', 'hairpinUp']]) {
      const r = route(both);
      expect(r.top, both).toBeGreaterThan(0);
      expect(flat(routePoint(r, r.top!).pos, mid(hill.runs[up].finish)), both).toBeLessThan(0.5);
    }
  });
});
