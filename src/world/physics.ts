import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

// grass and dirt slow the bike (tall grass, beside a trail, slows it hard); wall and rail stop it; the rest is smooth riding.
// rock: a boulder on a trail, low enough to see over
export type Surface = 'ground' | 'grass' | 'tallgrass' | 'dirt' | 'ramp' | 'wall' | 'rail' | 'rock';
export interface Physics { world: RAPIER.World; surfaceOf: Map<number, Surface> }
export interface GroundHit { height: number; normal: THREE.Vector3; surface: Surface }
export interface RayHit { dist: number; surface: Surface }
export interface Tumble { rider: RAPIER.RigidBody; bike: RAPIER.RigidBody }

// Every mesh with userData.collide becomes a static trimesh collider.
export async function createPhysics(root: THREE.Object3D): Promise<Physics> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -16, z: 0 });
  const surfaceOf = new Map<number, Surface>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const surface = mesh.userData.collide as Surface | undefined;
    if (!mesh.isMesh || !surface) return;
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const pos = geo.getAttribute('position');
    const vertices = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) vertices.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
    const indices = geo.index ? new Uint32Array(geo.index.array) : Uint32Array.from({ length: pos.count }, (_, i) => i);
    const collider = world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices));
    surfaceOf.set(collider.handle, surface);
    geo.dispose();
  });
  world.updateSceneQueries();
  return { world, surfaceOf };
}

const DOWN = { x: 0, y: -1, z: 0 };
// Rays only see the static world, never the tumbling rider and bike.
const STATIC_ONLY = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;

export function castDown(p: Physics, x: number, fromY: number, z: number, maxDist: number): GroundHit | null {
  const hit = p.world.castRayAndGetNormal(new RAPIER.Ray({ x, y: fromY, z }, DOWN), maxDist, true, STATIC_ONLY);
  if (!hit) return null;
  return {
    height: fromY - hit.timeOfImpact,
    normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    surface: p.surfaceOf.get(hit.collider.handle) ?? 'ground',
  };
}

export function rayHit(p: Physics, from: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
  const hit = p.world.castRay(new RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z }), maxDist, true, STATIC_ONLY);
  return hit ? { dist: hit.timeOfImpact, surface: p.surfaceOf.get(hit.collider.handle) ?? 'wall' } : null;
}

// The rider's body for collisions: a capsule lying along the bike from 0.35 m to 0.95 m above the ground,
// and a ball at head height. Anything lower than 0.35 m is a step the wheels roll up.
export const BODY = { lift: 0.35, radius: 0.3, half: 0.45, headUp: 1.45, headBack: 0.1, headR: 0.26, gap: 0.02 };
export interface WallHit { toi: number; normal: THREE.Vector3; surface: Surface; collider?: RAPIER.Collider } // toi: share of the move done before touching

const capsule = new RAPIER.Capsule(BODY.half, BODY.radius);
const capsuleSlim = new RAPIER.Capsule(BODY.half, BODY.radius - 0.04);
const head = new RAPIER.Ball(BODY.headR);
const qYaw = new THREE.Quaternion(), qLie = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const qTmp = new THREE.Quaternion();
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function bodyPose(pos: THREE.Vector3, yaw: number) {
  qTmp.copy(qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)).multiply(qLie);
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  return {
    capsule: { x: pos.x, y: pos.y + BODY.lift + BODY.radius, z: pos.z },
    rot: { x: qTmp.x, y: qTmp.y, z: qTmp.z, w: qTmp.w },
    head: { x: pos.x - fx * BODY.headBack, y: pos.y + BODY.headUp, z: pos.z - fz * BODY.headBack },
  };
}

// Sweep the body along a move and report the first wall it would touch. Shape casts catch thin poles
// that a single ray misses, and the body never passes through what it hits.
export function sweepBody(p: Physics, pos: THREE.Vector3, yaw: number, move: THREE.Vector3): WallHit | null {
  if (move.lengthSq() < 1e-10) return null;
  const pose = bodyPose(pos, yaw);
  const vel = { x: move.x, y: move.y, z: move.z };
  const a = p.world.castShape(pose.capsule, pose.rot, vel, capsule, BODY.gap, 1, false, STATIC_ONLY);
  const b = p.world.castShape(pose.head, IDENTITY, vel, head, BODY.gap, 1, false, STATIC_ONLY);
  const hit = a && b ? (a.time_of_impact <= b.time_of_impact ? a : b) : a ?? b;
  if (!hit) return null;
  return {
    toi: hit.time_of_impact,
    normal: new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z),
    surface: p.surfaceOf.get(hit.collider.handle) ?? 'wall',
  };
}

// Whether the body fits at this spot and heading, a hair slimmer so resting against a wall still fits.
export function bodyFits(p: Physics, pos: THREE.Vector3, yaw: number): boolean {
  const pose = bodyPose(pos, yaw);
  return p.world.intersectionWithShape(pose.capsule, pose.rot, capsuleSlim, STATIC_ONLY) === null;
}

// Crash tumble: the rider and the bike fly apart as two loose bodies.
export function spawnTumble(p: Physics, at: THREE.Vector3, vel: THREE.Vector3, spin: number): Tumble {
  const make = (dy: number, shape: RAPIER.ColliderDesc, sx: number) => {
    const body = p.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(at.x, at.y + dy, at.z)
        .setLinvel(vel.x, vel.y + 2, vel.z)
        .setAngvel({ x: spin * sx, y: spin * 0.5, z: spin })
        .setCcdEnabled(true),
    );
    p.world.createCollider(shape.setRestitution(0.35).setFriction(0.8), body);
    return body;
  };
  return { rider: make(1.2, RAPIER.ColliderDesc.capsule(0.35, 0.22), 1), bike: make(0.4, RAPIER.ColliderDesc.cuboid(0.7, 0.35, 0.12), -0.6) };
}

export function removeTumble(p: Physics, t: Tumble): void {
  p.world.removeRigidBody(t.rider);
  p.world.removeRigidBody(t.bike);
}
