import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPhysics, castDown, rayHit, spawnTumble, sweepBody, bodyFits } from '../src/world/physics';

function yard() {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40));
  ground.position.y = -0.5;
  ground.userData.collide = 'grass';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 10));
  wall.position.set(10, 1.5, 0);
  wall.userData.collide = 'wall';
  const untagged = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  untagged.position.set(-5, 0.5, 0);
  root.add(ground, wall, untagged);
  return root;
}

describe('physics queries', () => {
  it('castDown finds the ground height and its surface tag', async () => {
    const p = await createPhysics(yard());
    const hit = castDown(p, 0, 5, 0, 10);
    expect(hit?.height).toBeCloseTo(0);
    expect(hit?.surface).toBe('grass');
    expect(hit?.normal.y).toBeCloseTo(1);
  });

  it('only tagged meshes collide', async () => {
    const p = await createPhysics(yard());
    expect(castDown(p, -5, 5, 0, 10)?.height).toBeCloseTo(0);
  });

  it('rayHit reports distance and surface', async () => {
    const p = await createPhysics(yard());
    const hit = rayHit(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), 20);
    expect(hit?.dist).toBeCloseTo(9.5);
    expect(hit?.surface).toBe('wall');
  });

  it('rays ignore the tumbling rider and bike', async () => {
    const p = await createPhysics(yard());
    spawnTumble(p, new THREE.Vector3(5, 0, 0), new THREE.Vector3(), 0);
    p.world.step();
    const hit = rayHit(p, new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(1, 0, 0), 20);
    expect(hit?.surface).toBe('wall');
  });

  it('sweepBody stops short of a wall and reports its face', async () => {
    const p = await createPhysics(yard());
    const hit = sweepBody(p, new THREE.Vector3(5, 0, 0), 0, new THREE.Vector3(10, 0, 0));
    expect(hit?.toi).toBeGreaterThan(0.3); // the body front reaches 0.75 m ahead; the wall face is at x = 9.5
    expect(hit?.toi).toBeLessThan(0.4);
    expect(hit?.normal.x).toBeCloseTo(-1);
  });

  it('sweepBody rolls over a curb but not a low wall', async () => {
    const root = yard();
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 10));
    curb.position.set(2, 0.075, 0);
    curb.userData.collide = 'ground';
    root.add(curb);
    const p = await createPhysics(root);
    expect(sweepBody(p, new THREE.Vector3(0, 0, 0), 0, new THREE.Vector3(3, 0, 0))).toBeNull();
  });

  it('bodyFits is false inside a wall and true beside it', async () => {
    const p = await createPhysics(yard());
    expect(bodyFits(p, new THREE.Vector3(10, 0, 0), 0)).toBe(false);
    expect(bodyFits(p, new THREE.Vector3(8.7, 0, 0), 0)).toBe(true);
  });
});
