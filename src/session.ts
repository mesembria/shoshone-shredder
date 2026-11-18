// One rider's ride: the fixed 60 Hz step, crash tumbles and getting back up. No rendering, so tests can run it.
import * as THREE from 'three';
import type { BikeSpec } from './rules/bikes';
import { createBikeState, forward, stepBike, type BikeState, type Intent, type StepEvents } from './bike/controller';
import { castDown, removeTumble, spawnTumble, type Physics, type Tumble } from './world/physics';

export const STEP = 1 / 60;
const MAX_STEPS = 6; // after a long stall, skip ahead instead of running a burst of catch-up steps
const FELL_OUT = -20; // below the world: put the rider back

export interface SessionEvent extends StepEvents { tumbleStart?: boolean; tumbleEnd?: boolean }
export interface Session {
  state: BikeState;
  tumble: Tumble | null;
  advance(dt: number, read: () => Intent): SessionEvent[];
}

export function createSession(phys: Physics, bike: BikeSpec, start: { pos: THREE.Vector3; yaw: number }): Session {
  const state = createBikeState(bike, start.pos, start.yaw);
  const vel = new THREE.Vector3();
  let acc = 0, time = 0;
  const session: Session = { state, tumble: null, advance };

  function step(read: () => Intent): SessionEvent {
    const intent = read();
    if (state.pos.y < FELL_OUT) intent.again = true;
    const ev: SessionEvent = stepBike(state, intent, STEP, time, phys);
    time += STEP;
    if (state.crash && !session.tumble) {
      forward(state, vel).multiplyScalar(state.speed);
      vel.y = Math.max(0, state.vy);
      session.tumble = spawnTumble(phys, state.pos, vel, state.crash.outcome === 'big' ? 9 : 6);
      ev.tumbleStart = true;
    }
    if (session.tumble && !state.crash) {
      removeTumble(phys, session.tumble);
      session.tumble = null;
      ev.tumbleEnd = true;
    }
    if (session.tumble) {
      phys.world.step();
      // the rider gets up where the bike ends up
      const b = session.tumble.bike.translation();
      const below = castDown(phys, b.x, b.y + 1, b.z, 40);
      if (below) state.pos.set(b.x, below.height, b.z);
    }
    return ev;
  }

  function advance(dt: number, read: () => Intent): SessionEvent[] {
    const out: SessionEvent[] = [];
    acc = Math.min(acc + dt, MAX_STEPS * STEP);
    while (acc >= STEP) {
      out.push(step(read));
      acc -= STEP;
    }
    return out;
  }

  return session;
}
