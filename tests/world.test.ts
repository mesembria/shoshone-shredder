import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildWorld, mergeStatic, START, START_PARK } from '../src/world/build';
import { createPhysics, castDown, type Physics } from '../src/world/physics';
import { createBikeState, stepBike, type StepEvents } from '../src/bike/controller';
import { BIKES } from '../src/rules/bikes';

let world: THREE.Group;
let phys: Physics;
beforeAll(async () => {
  world = buildWorld();
  phys = await createPhysics(world);
});

describe('the home street', () => {
  it('starts on the driveway', () => {
    const hit = castDown(phys, START.pos.x, START.pos.y + 1.2, START.pos.z, 4);
    expect(hit?.surface).toBe('ground');
    expect(hit?.height).toBeCloseTo(START.pos.y, 2);
  });

  it('the park start sits on the path, in line with the park kicker', () => {
    expect(castDown(phys, START_PARK.pos.x, START_PARK.pos.y + 1.2, START_PARK.pos.z, 4)?.height).toBeCloseTo(START_PARK.pos.y, 2);
    expect(castDown(phys, START_PARK.pos.x, 4, -20.5, 5)?.surface).toBe('ramp');
  });

  it('has the driveway kicker and the park kicker', () => {
    expect(castDown(phys, -8.2, 3, -8.4, 5)?.surface).toBe('ramp');
    expect(castDown(phys, 30, 4, -21.9, 5)?.surface).toBe('ramp');
  });

  it('tags lawns as grass, mulch as dirt and houses as walls', () => {
    expect(castDown(phys, -20, 3, -10, 5)?.surface).toBe('grass');
    expect(castDown(phys, 44, 3, -14.5, 5)?.surface).toBe('dirt');
    expect(castDown(phys, 3, 12, -24, 15)?.surface).toBe('wall');
  });

  it('rolls off the start, jumps the driveway kicker and lands', () => {
    const s = createBikeState(BIKES.bolinas, START.pos, START.yaw);
    const events: StepEvents[] = [];
    for (let i = 0; i < 180; i++) events.push(stepBike(s, { steer: 0, throttle: 0, hop: null, swipe: null, again: false }, 1 / 60, i / 60, phys));
    const landings = events.flatMap((e) => (e.landed ? [e.landed] : []));
    expect(landings.length).toBeGreaterThan(0);
    expect(landings.every((l) => l === 'clean' || l === 'bobble')).toBe(true);
    expect(s.pos.z).toBeGreaterThan(0); // out in the street
  });

  it('the park kicker launches big and lands clean, with nothing in the way', () => {
    const s = createBikeState(BIKES.bolinas, START_PARK.pos, START_PARK.yaw);
    const events: StepEvents[] = [];
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      events.push(stepBike(s, { steer: 0, throttle: 1, hop: null, swipe: null, again: false }, 1 / 60, i / 60, phys));
      peak = Math.max(peak, s.pos.y);
    }
    expect(peak).toBeGreaterThan(2.3);
    expect(events.flatMap((e) => (e.landed ? [e.landed] : []))).toEqual(['clean']);
    expect(events.some((e) => e.bump || e.scrape)).toBe(false);
  });

  it('the garage door sits on the driveway, not in the same plane as its edge', () => {
    expect(castDown(phys, -8.2, 1, -15.6, 2)?.surface).toBe('ground');
  });

  it('merges into a few dozen meshes after the colliders are built', () => {
    const copy = buildWorld();
    mergeStatic(copy);
    let meshes = 0;
    copy.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBeLessThan(60);
  });
});
