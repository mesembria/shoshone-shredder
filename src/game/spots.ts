// The checks that turn the bike's position into challenge events (the pump track's lap line, the skinny planks,
// the timed runs' lines). Where the rings and zones are lives in the Course.
import * as THREE from 'three';
import type { Course, Gate, Plank, PumpTrack } from '../lab/course';

export interface Where { x: number; y: number; z: number; grounded: boolean }

// The lap line crosses the near straight a little way in from the start; the far straight is the checkpoint. The pump
// track is the course's (Course.pumpTrack).
export function lapEvent(prev: Where, cur: Where, PT: PumpTrack): 'start' | 'check' | null {
  const LAP_X = PT.x - PT.half + 4;
  if (cur.z < PT.z && Math.abs(cur.z - (PT.z - PT.R)) < 3 && prev.x < LAP_X && cur.x >= LAP_X) return 'start';
  if (Math.abs(cur.z - (PT.z + PT.R)) < 3 && Math.abs(cur.x - PT.x) < 6) return 'check';
  return null;
}

// Watches for getting onto a skinny, falling off its side, and reaching its end.
// The planks are the course's (Course.planks); the first is the narrow one.
export function createPlankWatch(PLANKS: Plank[]): (w: Where) => 'on' | 'off' | 'end' | null {
  if (!PLANKS.length) return () => null;
  let on = false, done = false;
  const along = (x: number) => x > PLANKS[0].x0 - 0.3 && x < PLANKS[0].x1;
  return (w) => {
    if (done) return null;
    const plank = Math.abs(w.z - PLANKS[0].z) < PLANKS[0].width / 2 + 0.2 ? PLANKS[0] : undefined; // the narrow one: the wide plank is practice
    if (!on) {
      if (plank && w.grounded && along(w.x) && w.y > plank.y - 0.1) return (on = true), 'on';
      return null;
    }
    if (w.x >= PLANKS[0].x1) return (done = true), 'end';
    if (w.grounded && w.y < 0.15 && along(w.x)) return (done = true), 'off';
    return null;
  };
}

// Riding across a line from one side to the other: true when the step from p to q crosses segment a-b.
export function segmentsCross(p: THREE.Vector2, q: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2): boolean {
  const side = (o: THREE.Vector2, u: THREE.Vector2, v: THREE.Vector2) => Math.sign((u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x));
  return side(p, q, a) !== side(p, q, b) && side(a, b, p) !== side(a, b, q);
}

// A timed run's start, via or finish line, crossed the right way (the riding direction is to the left of a to b). Runs
// are keyed by challenge id, so two runs can share a start ring (Goat Ladder ↑ and ↕).
const pv = new THREE.Vector2(), qv = new THREE.Vector2();
// (only the lines: a run's route is src/game/stayOnTrail.ts's business)
export function runEvent(id: string, prev: Where, cur: Where, runs: Record<string, Pick<Course['runs'][string], 'start' | 'finish'>>): 'start' | 'finish' | null {
  const r = runs[id];
  if (!r) return null;
  pv.set(prev.x, prev.z);
  qv.set(cur.x, cur.z);
  const forward = (g: Gate) => (cur.x - prev.x) * -(g.b.y - g.a.y) + (cur.z - prev.z) * (g.b.x - g.a.x) > 0;
  if (segmentsCross(pv, qv, r.start.a, r.start.b) && forward(r.start)) return 'start';
  if (segmentsCross(pv, qv, r.finish.a, r.finish.b) && forward(r.finish)) return 'finish';
  return null;
}
