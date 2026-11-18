// Puffs and specks from one instanced mesh: a single draw call for every particle.
import * as THREE from 'three';
import { forward, type BikeState } from '../bike/controller';
import type { Surface } from '../world/physics';

const N = 128;
const COLORS: Record<Surface, number[]> = {
  ground: [0xd9d4ca, 0xc4beb2],
  grass: [0x8fae5a, 0x6f8f3e, 0xd9d4ca],
  tallgrass: [0xc8b76c, 0xa3a675, 0xd8c98a],
  dirt: [0xb39d7f, 0x8f7a5e],
  ramp: [0xd8b98c, 0xc9a574],
  wall: [0xd9d4ca],
  rail: [0xd9d4ca],
  rock: [0xb5a891, 0x9c8f78],
};

interface Bit { pos: THREE.Vector3; vel: THREE.Vector3; life: number; max: number; size: number; rise: number }
export interface Fx {
  puff(at: THREE.Vector3, surface: Surface, strength: number): void;
  burst(at: THREE.Vector3, surface: Surface): void;
  huff(at: THREE.Vector3): void;
  update(dt: number, s: BikeState): void;
}

export function createFx(scene: THREE.Scene): Fx {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const bits: Bit[] = Array.from({ length: N }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, size: 1, rise: 0 }));
  const color = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), fwd = new THREE.Vector3();
  let next = 0, dustClock = 0, huffClock = 0, skidClock = 0;
  for (let i = 0; i < N; i++) mesh.setColorAt(i, color.set(0xffffff));

  // rise > 0 floats up (breath puffs); everything else falls
  function spawn(at: THREE.Vector3, vel: THREE.Vector3, hex: number, size: number, life: number, rise = 0): void {
    const i = next;
    next = (next + 1) % N;
    const b = bits[i];
    b.pos.copy(at);
    b.vel.copy(vel);
    b.life = b.max = life;
    b.size = size;
    b.rise = rise;
    mesh.setColorAt(i, color.set(hex));
    mesh.instanceColor!.needsUpdate = true;
  }
  const huff = (at: THREE.Vector3) =>
    spawn(at, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4), 0xffffff, 0.8, 0.7, 0.6);
  const pick = (s: Surface) => COLORS[s][Math.floor(Math.random() * COLORS[s].length)];
  const ring = (at: THREE.Vector3, count: number, speed: number, up: number, surface: Surface, size: number, life: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      spawn(at, new THREE.Vector3(Math.cos(a) * speed, up * (0.5 + Math.random()), Math.sin(a) * speed), pick(surface), size * (0.7 + Math.random() * 0.6), life);
    }
  };

  return {
    puff(at, surface, strength) {
      ring(at, Math.round(6 + 10 * strength), 1.5 + 2 * strength, 1.2 + strength, surface, 1 + strength * 0.6, 0.6);
    },
    burst(at, surface) {
      ring(at, 20, 4, 3, surface, 1.6, 0.9);
    },
    huff,
    update(dt, s) {
      // dust kicks up behind the rear wheel above cruise speed
      dustClock += dt * (s.grounded && !s.crash ? Math.max(0, s.speed - s.bike.cruise) * 8 : 0);
      forward(s, fwd);
      while (dustClock >= 1) {
        dustClock -= 1;
        const at = s.pos.clone().addScaledVector(fwd, -0.6);
        at.y += 0.1;
        spawn(at, new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2).addScaledVector(fwd, -1.5), pick(s.surface), 0.9, 0.5);
      }
      // a skid throws a spray from the sliding rear wheel
      skidClock += dt * (s.skidding ? 40 : 0);
      while (skidClock >= 1) {
        skidClock -= 1;
        const at = s.pos.clone().addScaledVector(fwd, -0.55);
        at.y += 0.08;
        spawn(at, new THREE.Vector3((Math.random() - 0.5) * 2.5, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 2.5), pick(s.surface), 1.0, 0.55);
      }
      huffClock -= dt;
      if (s.winded > 0 && huffClock <= 0) {
        huffClock = 0.45;
        huff(s.pos.clone().addScaledVector(fwd, 0.3).add(new THREE.Vector3(0, 1.5, 0)));
      }
      for (let i = 0; i < N; i++) {
        const b = bits[i];
        if (b.life > 0) {
          b.life -= dt;
          b.vel.y += (b.rise > 0 ? b.rise : -6) * dt;
          b.vel.multiplyScalar(Math.exp(-dt * 2.5));
          b.pos.addScaledVector(b.vel, dt);
        }
        const k = b.life > 0 ? b.size * Math.sin((Math.PI * b.life) / b.max) : 0;
        mesh.setMatrixAt(i, m.compose(b.pos, q, sc.setScalar(k)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
