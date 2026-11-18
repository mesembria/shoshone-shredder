// The rider's body for collisions, tilted with the bike. The prototype's body stays level, which on a steep
// takeoff pokes its front end into the ramp and reads as a wall.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { BODY, type Physics, type WallHit } from '../world/physics';

const capsule = new RAPIER.Capsule(BODY.half, BODY.radius);
const capsuleSlim = new RAPIER.Capsule(BODY.half, BODY.radius - 0.04);
const head = new RAPIER.Ball(BODY.headR);
const STATIC_ONLY = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;
const Y = new THREE.Vector3(0, 1, 0), Zax = new THREE.Vector3(0, 0, 1);
const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), qLie = new THREE.Quaternion().setFromAxisAngle(Zax, Math.PI / 2);
const qBike = new THREE.Quaternion(), qCap = new THREE.Quaternion(), off = new THREE.Vector3();
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function pose(pos: THREE.Vector3, yaw: number, pitch: number) {
  qBike.copy(qYaw.setFromAxisAngle(Y, yaw)).multiply(qPitch.setFromAxisAngle(Zax, pitch));
  qCap.copy(qBike).multiply(qLie);
  off.set(0, BODY.lift + BODY.radius, 0).applyQuaternion(qBike);
  const c = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
  off.set(-BODY.headBack, BODY.headUp, 0).applyQuaternion(qBike);
  return { capsule: c, rot: { x: qCap.x, y: qCap.y, z: qCap.z, w: qCap.w }, head: { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z } };
}

// exclude: a collider to ignore (one the body already touches and is sliding along)
export function sweepTilted(p: Physics, pos: THREE.Vector3, yaw: number, pitch: number, move: THREE.Vector3, exclude?: RAPIER.Collider): WallHit | null {
  if (move.lengthSq() < 1e-10) return null;
  const b = pose(pos, yaw, pitch);
  const vel = { x: move.x, y: move.y, z: move.z };
  const a = p.world.castShape(b.capsule, b.rot, vel, capsule, BODY.gap, 1, false, STATIC_ONLY, undefined, exclude);
  const h = p.world.castShape(b.head, IDENTITY, vel, head, BODY.gap, 1, false, STATIC_ONLY, undefined, exclude);
  const hit = a && h ? (a.time_of_impact <= h.time_of_impact ? a : h) : a ?? h;
  if (!hit) return null;
  return { toi: hit.time_of_impact, normal: new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z), surface: p.surfaceOf.get(hit.collider.handle) ?? 'wall', collider: hit.collider };
}

export function fitsTilted(p: Physics, pos: THREE.Vector3, yaw: number, pitch: number): boolean {
  const b = pose(pos, yaw, pitch);
  return p.world.intersectionWithShape(b.capsule, b.rot, capsuleSlim, STATIC_ONLY) === null;
}

// Whether the full-size body is pressed into a rock or a wall (a plant clump, a post). fitsTilted checks a slimmer body,
// so it still says yes for a body pressed in by a few cm, while every full-size sweep from there is blocked at once:
// touching on both sides, that's a trap. (Only obstacles: the slim margin is for the ground under the body.)
const capsulePress = new RAPIER.Capsule(BODY.half, BODY.radius - 0.005);
export function pressedTilted(p: Physics, pos: THREE.Vector3, yaw: number, pitch: number): boolean {
  const b = pose(pos, yaw, pitch);
  return p.world.intersectionWithShape(b.capsule, b.rot, capsulePress, STATIC_ONLY, undefined, undefined, undefined, (c) => {
    const sf = p.surfaceOf.get(c.handle);
    return sf === 'rock' || sf === 'wall';
  }) !== null;
}
