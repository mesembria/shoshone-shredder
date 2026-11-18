import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPhysics } from '../src/world/physics';
import { createBikeState, stepBike, type Intent, type StepEvents } from '../src/bike/controller';
import { BIKES } from '../src/rules/bikes';

const ride: Intent = { steer: 0, throttle: 0, hop: null, swipe: null, again: false };
const tagged = (mesh: THREE.Mesh, collide: string) => { mesh.userData.collide = collide; return mesh; };

function testYard(withWall: boolean) {
  const root = new THREE.Group();
  const ground = tagged(new THREE.Mesh(new THREE.BoxGeometry(200, 1, 40)), 'ground');
  ground.position.y = -0.5;
  root.add(ground);
  // a 1 m tall, 2.5 m long kicker facing +x, its lip at x = 0
  const shape = new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 1)]);
  const kicker = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
  kicker.translate(0, 0, -1);
  root.add(tagged(new THREE.Mesh(kicker), 'ramp'));
  if (withWall) {
    const wall = tagged(new THREE.Mesh(new THREE.BoxGeometry(1, 3, 10)), 'wall');
    wall.position.set(40, 1.5, 0);
    root.add(wall);
  }
  return root;
}

function rideFor(seconds: number, phys: Awaited<ReturnType<typeof createPhysics>>, s: ReturnType<typeof createBikeState>, input: Intent) {
  const events: StepEvents[] = [];
  for (let i = 0; i < seconds * 60; i++) events.push(stepBike(s, input, 1 / 60, i / 60, phys));
  return events;
}

describe('stepBike on a test yard', () => {
  it('rolls up the kicker, flies and lands without crashing', async () => {
    const phys = await createPhysics(testYard(false));
    const s = createBikeState(BIKES.bolinas, new THREE.Vector3(-30, 0, 0), 0);
    const events = rideFor(8, phys, s, ride);
    const landings = events.filter((e) => e.landed).map((e) => e.landed);
    expect(landings.length).toBeGreaterThan(0);
    expect(landings).not.toContain('wipeout');
    expect(landings).not.toContain('big');
    expect(s.grounded).toBe(true);
  });

  it('leaves the lip in one clean launch, rising above it', async () => {
    const phys = await createPhysics(testYard(false));
    const s = createBikeState(BIKES.bolinas, new THREE.Vector3(-30, 0, 0), 0);
    let peak = 0;
    const events: StepEvents[] = [];
    for (let i = 0; i < 8 * 60; i++) {
      events.push(stepBike(s, ride, 1 / 60, i / 60, phys));
      peak = Math.max(peak, s.pos.y);
    }
    expect(events.filter((e) => e.landed)).toHaveLength(1);
    expect(peak).toBeGreaterThan(1.1);
  });

  it('hitting a wall at top speed is a big crash with stars and wind', async () => {
    const phys = await createPhysics(testYard(true));
    const s = createBikeState(BIKES.bolinas, new THREE.Vector3(10, 0, 0), 0);
    const events = rideFor(6, phys, s, { ...ride, throttle: 1 });
    expect(events.some((e) => e.landed === 'big')).toBe(true);
    expect(s.stars).toBeGreaterThan(0);
  });

  it('pressing into a wall bonks once, not every step', async () => {
    const phys = await createPhysics(testYard(true));
    const s = createBikeState(BIKES.bolinas, new THREE.Vector3(37.2, 0, 0), 0); // too close to the wall to get fast
    const events = rideFor(3, phys, s, ride);
    expect(events.filter((e) => e.bump)).toHaveLength(1);
    expect(s.crash).toBeNull();
  });

  it('a blocked rider never creeps through the wall', async () => {
    const phys = await createPhysics(testYard(true));
    const s = createBikeState(BIKES.bolinas, new THREE.Vector3(37.2, 0, 0), 0);
    rideFor(8, phys, s, ride);
    expect(s.pos.x).toBeLessThan(38.8); // the wall face is at x = 39.5; the body reaches 0.75 m ahead
  });

  it('a glancing hit at top speed slides along the wall instead of crashing', async () => {
    const root = new THREE.Group();
    const ground = tagged(new THREE.Mesh(new THREE.BoxGeometry(200, 1, 40)), 'ground');
    ground.position.y = -0.5;
    const wall = tagged(new THREE.Mesh(new THREE.BoxGeometry(100, 3, 1)), 'wall'); // runs along x, face at z = 2.5
    wall.position.set(0, 1.5, 3);
    root.add(ground, wall);
    const phys = await createPhysics(root);
    const s = createBikeState(BIKES.bolinas, new THREE.Vector3(-30, 0, 0), -0.25); // heading 14 degrees toward the wall
    const events = rideFor(5, phys, s, { ...ride, throttle: 1 });
    expect(events.some((e) => e.landed === 'wipeout' || e.landed === 'big')).toBe(false);
    expect(events.some((e) => e.scrape)).toBe(true);
    expect(s.speed).toBeGreaterThan(9);
    expect(s.pos.z).toBeLessThan(2.5 - 0.25);
    expect(s.pos.x).toBeGreaterThan(0);
  });

  it('thin poles are solid: the body goes round, never through', async () => {
    const root = new THREE.Group();
    const ground = tagged(new THREE.Mesh(new THREE.BoxGeometry(200, 1, 40)), 'ground');
    ground.position.y = -0.5;
    const pole = tagged(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8)), 'wall');
    pole.position.set(0, 1.5, 0.15); // just off the rider's line, where a single ray would miss it
    root.add(ground, pole);
    const phys = await createPhysics(root);
    const s = createBikeState(BIKES.bayview, new THREE.Vector3(-20, 0, 0), 0);
    let closest = Infinity;
    for (let i = 0; i < 6 * 60; i++) {
      stepBike(s, ride, 1 / 60, i / 60, phys);
      if (Math.abs(s.pos.x) < 0.3) closest = Math.min(closest, Math.abs(s.pos.z - 0.15));
    }
    expect(s.crash).toBeNull();
    expect(closest).toBeGreaterThan(0.3);
  });

  it('a skid turns much sharper than steering alone', async () => {
    const phys = await createPhysics(testYard(false));
    const steerOnly = createBikeState(BIKES.bayview, new THREE.Vector3(-60, 0, 10), 0);
    const skid = createBikeState(BIKES.bayview, new THREE.Vector3(-60, 0, -10), 0);
    steerOnly.speed = skid.speed = 7;
    rideFor(0.5, phys, steerOnly, { ...ride, steer: 1 });
    rideFor(0.5, phys, skid, { ...ride, steer: 1, throttle: -1 });
    expect(skid.skidding).toBe(true);
    expect(Math.abs(skid.yaw)).toBeGreaterThan(2 * Math.abs(steerOnly.yaw));
    expect(skid.speed).toBeGreaterThan(3); // a skid sheds speed, but less than a plain brake
  });

  it('dirt slows the bike the way grass does', async () => {
    const root = new THREE.Group();
    const floor = tagged(new THREE.Mesh(new THREE.BoxGeometry(200, 1, 40)), 'dirt');
    floor.position.y = -0.5;
    root.add(floor);
    const phys = await createPhysics(root);
    const s = createBikeState(BIKES.bayview, new THREE.Vector3(-60, 0, 0), 0);
    rideFor(5, phys, s, ride);
    expect(s.speed).toBeCloseTo(BIKES.bayview.cruise * BIKES.bayview.grassFactor, 1);
  });

  it('Again puts the rider back at the start of the last run-up', async () => {
    const phys = await createPhysics(testYard(false));
    const s = createBikeState(BIKES.bayview, new THREE.Vector3(-30, 0, 0), 0);
    rideFor(8, phys, s, ride);
    const respawnX = s.respawn.pos.x;
    stepBike(s, { ...ride, again: true }, 1 / 60, 0, phys);
    expect(s.pos.x).toBeCloseTo(respawnX);
    expect(respawnX).toBeLessThan(0);
  });
});
