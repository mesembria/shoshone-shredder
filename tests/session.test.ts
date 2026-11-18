import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPhysics } from '../src/world/physics';
import { createSession, type SessionEvent } from '../src/session';
import { BIKES } from '../src/rules/bikes';
import type { Intent } from '../src/bike/controller';

const push: Intent = { steer: 0, throttle: 1, hop: null, swipe: null, again: false };

async function wallYard() {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 40));
  ground.position.y = -0.5;
  ground.userData.collide = 'ground';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 10));
  wall.position.set(40, 1.5, 0);
  wall.userData.collide = 'wall';
  root.add(ground, wall);
  return createPhysics(root);
}

function rideSeconds(session: ReturnType<typeof createSession>, seconds: number, intent: () => Intent) {
  const events: SessionEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) events.push(...session.advance(1 / 60, intent));
  return events;
}

describe('session', () => {
  it('runs fixed 60 Hz steps and skips ahead after a stall', async () => {
    const session = createSession(await wallYard(), BIKES.bolinas, { pos: new THREE.Vector3(0, 0, 0), yaw: 0 });
    expect(session.advance(1 / 30, () => push)).toHaveLength(2);
    expect(session.advance(1, () => push)).toHaveLength(6);
  });

  it('a big crash tumbles, then the rider gets up near the wall and the tumble is cleared', async () => {
    const phys = await wallYard();
    const session = createSession(phys, BIKES.bolinas, { pos: new THREE.Vector3(10, 0, 0), yaw: 0 });
    const events = rideSeconds(session, 6, () => push);
    const start = events.findIndex((e) => e.tumbleStart);
    const end = events.findIndex((e) => e.tumbleEnd);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(session.tumble).toBeNull();
    expect(phys.world.bodies.len()).toBe(0);
    expect(Math.abs(session.state.pos.x - 39)).toBeLessThan(6);
  });

  it('Again during a tumble ends it at once', async () => {
    const session = createSession(await wallYard(), BIKES.bolinas, { pos: new THREE.Vector3(10, 0, 0), yaw: 0 });
    let events: SessionEvent[] = [];
    while (!events.some((e) => e.tumbleStart)) events = session.advance(1 / 60, () => push);
    const after = session.advance(1 / 60, () => ({ ...push, again: true }));
    expect(after.some((e) => e.tumbleEnd)).toBe(true);
    expect(session.state.crash).toBeNull();
  });
});
