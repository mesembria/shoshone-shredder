// The parked SUV the lots have (Mesa Jump Park's lot by Cone Zone, the Trailhead lot): ride into it, hop at it and drop
// onto it, and the bike never ends up inside it or stuck by it (riders got stuck in the car and couldn't ride out).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { createPhysics, castDown, spawnTumble, removeTumble, type Physics, type Tumble } from '../src/world/physics';
import { car } from '../src/world/build';
import { createLabState, placeBike, stepLab, type LabIntent, type LabState } from '../src/lab/bike';
import { LAB_BIKES, applyBike, type LabBikeId } from '../src/lab/bikes';
import { T, DEFAULTS } from '../src/lab/tune';
import { fitsTilted } from '../src/lab/body';
import { forward } from '../src/bike/controller';

const DT = 1 / 60;
// the car at the origin, its length along x: body 4.7 x 2.0, the wheels sticking out a little past its sides
const HALF = { x: 2.35, z: 1.1 };
let phys: Physics; // what the bike collides with
let looks: Physics; // every piece of the car as you see it, all solid: the bike's body must never be inside any of it

async function carYard(allSolid: boolean): Promise<Physics> {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60));
  ground.position.y = -0.5;
  ground.userData.collide = 'ground';
  root.add(ground);
  car(root, 0, 0, 0, 0xffffff, false);
  if (allSolid) root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.collide ??= 'wall'; });
  root.updateMatrixWorld(true);
  return createPhysics(root);
}

beforeAll(async () => {
  phys = await carYard(false);
  looks = await carYard(true);
});

const intent = (o: Partial<LabIntent> = {}): LabIntent => ({ steer: 0, throttle: 0, hop: null, swipe: null, again: false, crouch: false, ...o });
const overCar = (p: THREE.Vector3) => Math.abs(p.x) < HALF.x + 0.3 && Math.abs(p.z) < HALF.z + 0.3;

function bikeAt(id: LabBikeId, pos: THREE.Vector3, yaw: number): LabState {
  Object.assign(T, DEFAULTS);
  applyBike(id);
  const s = createLabState(LAB_BIKES[id], pos.clone(), yaw);
  placeBike(s, pos.clone(), yaw);
  return s;
}

// Ride as the game does (src/lab/ride.ts): a crash tumbles the loose rider and bike, and you get up where the bike ends
// up. Every step on the ground, the body must be clear of the car as you see it (in the air it can graze the car's edge
// for a step or two: the fall isn't swept, and landing overlapping anything stands you clear). Returns the first step
// it wasn't.
function ride(s: LabState, i: Partial<LabIntent>, seconds: number, hopAt = -1): string | null {
  let tumble: Tumble | null = null, inside: string | null = null;
  const vel = new THREE.Vector3();
  for (let n = 0; n < seconds / DT; n++) {
    stepLab(s, intent({ ...i, hop: n === hopAt ? 0.45 : null }), DT, phys, []);
    if (s.crash && !tumble) {
      forward(s, vel).multiplyScalar(s.speed);
      vel.y = Math.max(0, s.vy);
      tumble = spawnTumble(phys, s.pos, vel, s.crash.outcome === 'big' ? 9 : 6);
    }
    if (tumble && !s.crash) {
      removeTumble(phys, tumble);
      tumble = null;
    }
    if (tumble) {
      phys.world.step();
      const b = tumble.bike.translation(), below = castDown(phys, b.x, b.y + 1, b.z, 40);
      if (below) s.pos.set(b.x, below.height, b.z);
    } else if (!inside && s.grounded && !fitsTilted(looks, s.pos, s.yaw, s.pitch)) {
      inside = `inside the car at (${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)}, ${s.pos.z.toFixed(2)})`;
    }
  }
  if (tumble) removeTumble(phys, tumble);
  return inside;
}

// Wherever it ended up, the bike fits there and some way of riding takes it clear of the car (there is no reverse).
function ridesOut(s: LabState, id: LabBikeId): boolean {
  if (s.crash) ride(s, {}, 3);
  if (!fitsTilted(phys, s.pos, s.yaw, s.pitch)) return false;
  const from = s.pos.clone(), yaw = s.yaw;
  for (const steer of [0, 1, -1]) {
    const t = bikeAt(id, from, yaw);
    for (let n = 0; n < 4 / DT; n++) {
      stepLab(t, intent({ throttle: 1, steer }), DT, phys, []);
      if (t.crash) break;
      if (t.pos.distanceTo(from) > 1.5 && !overCar(t.pos)) return true;
    }
  }
  return false;
}

describe('the parked car', () => {
  it('dropping onto it anywhere never leaves you inside it', () => {
    const bad: string[] = [];
    for (const id of ['bolinas', 'enduro'] as const) {
      for (let x = -2.4; x <= 2.41; x += 0.4) for (const z of [-0.9, 0, 0.9]) for (const y of [1.7, 2.6]) for (const yaw of [0, Math.PI / 2, 2.4]) {
        const s = bikeAt(id, new THREE.Vector3(x, 0, z), yaw);
        s.pos.set(x, y, z);
        Object.assign(s, { grounded: false, vy: -1, speed: 0 });
        const tag = `${id} drop at (${x.toFixed(1)}, ${y}, ${z}) yaw ${yaw.toFixed(1)}`;
        const inside = ride(s, { throttle: -1 }, 1.5); // land and stop there
        if (inside) bad.push(`${tag}: ${inside}`);
        else if (!ridesOut(s, id)) bad.push(`${tag}: stuck at (${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)}, ${s.pos.z.toFixed(2)})`);
      }
    }
    expect(bad.slice(0, 8), `${bad.length} bad`).toEqual([]);
  });

  it('riding or hopping into its sides and corners never leaves you inside it or stuck', () => {
    const bad: string[] = [];
    for (const id of ['bolinas', 'enduro'] as const) {
      for (let a = 0; a < 360; a += 30) for (const [tx, tz] of [[-2.3, 1], [0, 1], [2.3, 1], [2.3, 0], [-2.3, -1], [0, -1], [2.3, -1], [-2.3, 0]]) for (const speed of [3, 8]) for (const hopAt of [-1, 15, 30]) {
        const ang = (a * Math.PI) / 180, pos = new THREE.Vector3(tx + 6 * Math.cos(ang), 0, tz - 6 * Math.sin(ang));
        const yaw = Math.atan2(pos.z - tz, tx - pos.x);
        if (overCar(pos)) continue;
        const s = bikeAt(id, pos, yaw);
        s.speed = speed;
        const tag = `${id} from ${a}° at (${tx}, ${tz}), ${speed} m/s${hopAt < 0 ? '' : `, hop at step ${hopAt}`}`;
        const inside = ride(s, { throttle: speed > 5 ? 1 : 0 }, 2.5, hopAt);
        if (inside) bad.push(`${tag}: ${inside}`);
        else if (!ridesOut(s, id)) bad.push(`${tag}: stuck at (${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)}, ${s.pos.z.toFixed(2)})`);
      }
    }
    expect(bad.slice(0, 8), `${bad.length} bad`).toEqual([]);
  });
});
