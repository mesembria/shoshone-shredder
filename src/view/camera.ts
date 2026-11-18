// Chase camera: low behind the rider, higher when a house is in the way, farther back on big air.
import * as THREE from 'three';
import { forward, type BikeState } from '../bike/controller';
import { rayHit, type Physics } from '../world/physics';

export const CAM = {
  back: 6.5, up: 2.8, // normal spot behind the rider
  highBack: 2.5, highUp: 6.5, // higher and closer when a wall is in the way
  topBack: 0.6, topUp: 8, // last resort: almost straight overhead
  airBack: 0.9, airUp: 0.45, maxAir: 4, // pull back per meter of air, so the landing stays in view
  ahead: 4, follow: 3, aim: 6, // look ahead of the rider; how fast the camera catches up
  fovWide: 40, fovTall: 55, fovSpeed: 6, // the view widens a little with speed
  snap: 10, // a jump this far in one frame (Again) cuts instead of flying across the map
};

const fwd = new THREE.Vector3(), body = new THREE.Vector3();

// Try spots from low and far to high and close, then overhead; take the first with a clear view of the
// rider's body. Returns how high it had to go: 0 is the normal spot, 1 is overhead.
export function chaseSpot(s: BikeState, blocked: (from: THREE.Vector3, to: THREE.Vector3) => boolean, out: THREE.Vector3): number {
  forward(s, fwd);
  const air = Math.min(CAM.maxAir, Math.max(0, s.pos.y - s.groundY));
  body.set(s.pos.x, s.pos.y + 0.9, s.pos.z);
  const place = (back: number, up: number) => {
    out.copy(s.pos).addScaledVector(fwd, -(back + air * CAM.airBack));
    out.y += up + air * CAM.airUp;
  };
  for (const t of [0, 1 / 3, 2 / 3, 1]) {
    place(THREE.MathUtils.lerp(CAM.back, CAM.highBack, t), THREE.MathUtils.lerp(CAM.up, CAM.highUp, t));
    if (!blocked(body, out)) return t * 0.75;
  }
  place(CAM.topBack, CAM.topUp);
  return 1;
}

export interface ChaseCam { update(s: BikeState, dt: number): void }

export function createChaseCam(camera: THREE.PerspectiveCamera, phys: Physics, topSpeed: number): ChaseCam {
  const want = new THREE.Vector3(), aim = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3();
  const last = new THREE.Vector3();
  let first = true, level = 0;
  const blocked = (from: THREE.Vector3, to: THREE.Vector3) => {
    dir.subVectors(to, from);
    const len = dir.length();
    return rayHit(phys, from, dir.divideScalar(len), len + 0.4) !== null;
  };
  return {
    update(s, dt) {
      const wantLevel = chaseSpot(s, blocked, want);
      const cut = first || last.distanceTo(s.pos) > CAM.snap; // first frame, or Again moved the rider far
      first = false;
      last.copy(s.pos);
      level = cut ? wantLevel : level + (wantLevel - level) * (1 - Math.exp(-dt * CAM.follow));
      forward(s, fwd);
      const air = Math.min(CAM.maxAir, Math.max(0, s.pos.y - s.groundY));
      // the higher the camera has to sit, the closer to the rider it looks, so the rider stays in view
      aim.copy(s.pos).addScaledVector(fwd, CAM.ahead * (1 - level));
      aim.y += 1.1 - air * 0.5; // on big air, look down toward the landing
      if (cut) {
        camera.position.copy(want);
        look.copy(aim);
      }
      camera.position.lerp(want, 1 - Math.exp(-dt * CAM.follow));
      look.lerp(aim, 1 - Math.exp(-dt * CAM.aim));
      camera.lookAt(look);
      const speed = s.crash ? 0 : s.speed;
      const fov = (camera.aspect < 1 ? CAM.fovTall : CAM.fovWide) + CAM.fovSpeed * Math.min(1, speed / topSpeed);
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 3));
        camera.updateProjectionMatrix();
      }
    },
  };
}
