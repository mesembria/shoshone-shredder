// Lab chase camera: lower and closer than the prototype's, a view that widens a lot with speed, a little shake
// near top speed. It swings round behind the bike on a smoothed heading instead of chasing a point, so turns
// read as turns. Pulls back and looks down on big air; pulls in when a wall is in the way.
import * as THREE from 'three';
import type { BikeState } from '../bike/controller';
import { castDown, rayHit, type Physics } from '../world/physics';
import { T } from './tune';

export interface LabCam { update(s: BikeState, dt: number): void; snap(): void }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function speedShare(speed: number): number {
  return clamp((speed - T.cruise) / Math.max(1, T.maxSpeed - T.cruise), 0, 1);
}

export function createLabCam(camera: THREE.PerspectiveCamera, phys: Physics): LabCam {
  const want = new THREE.Vector3(), pos = new THREE.Vector3(), aim = new THREE.Vector3(), look = new THREE.Vector3();
  const body = new THREE.Vector3(), dir = new THREE.Vector3();
  let yaw = 0, first = true, clock = 0, air = 0;
  return {
    snap() {
      first = true;
    },
    update(s, dt) {
      clock += dt;
      if (first) yaw = s.yaw;
      yaw += wrap(s.yaw - yaw) * (1 - Math.exp(-dt * T.camYaw));
      const fx = Math.cos(yaw), fz = -Math.sin(yaw);
      // height over the ground, eased, so small bumps don't bob the camera
      const h = clamp(s.pos.y - s.groundY, 0, 6);
      air += (h - air) * (1 - Math.exp(-dt * 4));
      const back = T.camBack + air * 0.8, up = T.camUp + air * 0.45;
      want.set(s.pos.x - fx * back, s.pos.y + up, s.pos.z - fz * back);
      // ride above the ground behind the bike, so dropping down a hill keeps the same view
      const g = castDown(phys, want.x, want.y + 6, want.z, 30);
      if (g) want.y = Math.max(want.y, g.height + T.camUp * 0.8);
      // clear the view: rise over hills and crests; pull in only from walls
      body.set(s.pos.x, s.pos.y + 1, s.pos.z);
      for (let i = 0; i < 8; i++) {
        dir.subVectors(want, body);
        const len = dir.length();
        const hit = rayHit(phys, body, dir.divideScalar(len), len);
        if (!hit) break;
        if (hit.surface === 'wall' || hit.surface === 'rail') {
          want.copy(body).addScaledVector(dir, Math.max(1.2, hit.dist - 0.3));
          break;
        }
        want.y += 0.5;
      }
      aim.set(s.pos.x + fx * T.camAhead, s.pos.y + 1.1 - air * 0.45, s.pos.z + fz * T.camAhead);
      if (first) {
        pos.copy(want);
        look.copy(aim);
        first = false;
      }
      const k = 1 - Math.exp(-dt * 12), kv = 1 - Math.exp(-dt * 7);
      pos.x += (want.x - pos.x) * k;
      pos.z += (want.z - pos.z) * k;
      pos.y += (want.y - pos.y) * kv;
      look.lerp(aim, 1 - Math.exp(-dt * 14));
      const fast = s.crash ? 0 : speedShare(s.speed);
      const shake = T.shake * fast * fast + (s.crash ? 0 : ((s as { wobble?: number }).wobble ?? 0) * 0.08); // a speed wobble shakes the view
      camera.position.set(pos.x + shake * Math.sin(clock * 37), pos.y + shake * Math.sin(clock * 53 + 1), pos.z + shake * Math.sin(clock * 41 + 2));
      camera.lookAt(look);
      const fov = T.fovBase + (T.fovFast - T.fovBase) * fast;
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4));
        camera.updateProjectionMatrix();
      }
    },
  };
}
