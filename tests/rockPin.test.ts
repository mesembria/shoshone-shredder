import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildHill } from '../src/world/places/hill';
import { goatLadder } from '../src/world/trails/goatLadder';
import { hairpin, HAIRPIN } from '../src/world/trails/hairpin';
import { inZone, trailPoint } from '../src/world/trail';
import { createPhysics, castDown } from '../src/world/physics';
import { createLabState, placeBike, stepLab } from '../src/lab/bike';
import { LAB_BIKES, applyBike } from '../src/lab/bikes';
import { T, DEFAULTS } from '../src/lab/tune';

// A real pin found by the climb robots: the enduro ended up beside a rock on the first climb leg, its body touching
// the rock's lower edge, heading away along it. Every move came back blocked at distance zero and it never moved again.
// (Found on the old park's climb; here it is the first rock on Goat Ladder's way up, touched from the side.)
describe('rubbing a rock on the climb', () => {
  it('a bike touching a rock while heading away from it rides off', async () => {
    const course = buildHill();
    const phys = await createPhysics(course.world);
    Object.assign(T, DEFAULTS);
    applyBike('enduro');
    const up = course.trails.goatUp, rock = goatLadder().features.rocks.filter((r) => r.trail.id === up.id)[0];
    const side = rock.off >= 0 ? -1 : 1, p0 = trailPoint(up, rock.u + rock.r, rock.off + side * (rock.r + 0.3)), yaw = up.path.at(rock.u).yaw;
    const pos = new THREE.Vector3(p0.x, castDown(phys, p0.x, p0.y + 5, p0.z, 20)!.height, p0.z);
    const s = createLabState(LAB_BIKES.enduro, pos.clone(), yaw);
    placeBike(s, pos.clone(), yaw);
    s.speed = 2;
    for (let i = 0; i < 60; i++) stepLab(s, { steer: 0, throttle: 0, hop: null, swipe: null, again: false, crouch: false, climb: true }, 1 / 60, phys, course.lines);
    expect(s.pos.distanceTo(pos)).toBeGreaterThan(0.5);
  });
});

// Riding along a trail steering into its edge rocks (found by the final review: the body sank into the merged
// edge-rock wall and the bike was then launched into the sky).
describe('steering into a trail edge', async () => {
  const course = buildHill();
  const phys = await createPhysics(course.world);
  const hp = hairpin(), legs = hp.marks.legs.map(([a, b]) => (a + b) / 2);
  // [name, trail, u, half the trail's width or 0]: how far past the edge you get, riding the trail's way from u and steering
  // into the side. Only hairpin leg 1 is checked for staying between the edges: the hill's edges are grass and plant clumps,
  // not the old park's rock walls, so on the other legs you can leave the trail across the grass (it slows you). Every place
  // is checked for staying on the ground and not being launched.
  const T_ = course.trails;
  const places: [string, typeof T_.goatUp, number, number][] = [['chute top', T_.boulderDash, 2, 0], ['hairpin leg 1', T_.hairpin, legs[0], 1.25], ['hairpin leg 3', T_.hairpin, legs[2], 0], ['hairpin leg 4', T_.hairpin, legs[3], 0], ['hairpin leg 5 (the top)', T_.hairpin, legs[4], 0], ['goat leg 1', T_.goatUp, 10, 0]];
  for (const [name, trail, u0, half] of places) {
    it(`${name}: the bike stays on the ground${half ? ' and between the edges' : ''}`, () => {
      for (const id of ['bolinas', 'dirtjumper', 'enduro'] as const) for (const steer of [0.5, -0.5]) {
        Object.assign(T, DEFAULTS);
        applyBike(id);
        const p0 = trailPoint(trail, u0), yaw = trail.path.at(u0).yaw;
        const pos = new THREE.Vector3(p0.x, castDown(phys, p0.x, p0.y + 5, p0.z, 20)!.height, p0.z);
        const s = createLabState(LAB_BIKES[id], pos.clone(), yaw);
        placeBike(s, pos.clone(), yaw);
        let out = 0, maxVy = 0;
        for (let i = 0; i < 60 * 6; i++) {
          const here = (k: 'area' | 'loose') => course.climb[k].some((a) => inZone(a, s.pos.x, s.pos.z));
          stepLab(s, { steer, throttle: 1, hop: null, swipe: null, again: false, crouch: false, climb: here('area'), loose: here('loose'), rough: course.rough.some((a) => inZone(a, s.pos.x, s.pos.z)) }, 1 / 60, phys, course.lines);
          const n = trail.path.nearest(s.pos.x, s.pos.z);
          if (half && Math.abs(n.u - u0) < 30) out = Math.max(out, Math.abs(n.off) - half);
          maxVy = Math.max(maxVy, s.vy); // up: falling off the chute hill after getting over a rock is the old escape, not a launch
        }
        expect(maxVy, `${id} steer ${steer}`).toBeLessThan(20);
        expect(out, `${id} steer ${steer}`).toBeLessThan(1.05);
      }
    });
  }
});

// The ground probe under the middle of the bike landing on a near-vertical rock face (found by the final review: the
// bike then took the face's slope as its own and shot up at speed × tan(slope), 30 m/s and more).
describe('a near-vertical face under the bike', async () => {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 10));
  ground.position.set(0, -0.1, 0);
  ground.userData.collide = 'dirt';
  const face = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 4)); // a slab leaning back at 70°, rising from x 5
  face.rotation.z = (70 * Math.PI) / 180;
  face.position.set(5 + Math.cos(face.rotation.z), Math.sin(face.rotation.z), 0);
  face.userData.collide = 'rock';
  root.add(ground, face);
  root.updateMatrixWorld(true);
  const phys = await createPhysics(root);
  it("isn't ridden up as ground", async () => {
    Object.assign(T, DEFAULTS);
    applyBike('bolinas');
    // already part way up the face (turning in place against a rock can leave you there), riding off across it
    const { castDown } = await import('../src/world/physics');
    const pos = new THREE.Vector3(5.05, castDown(phys, 5.05, 0.6, 0, 4)!.height, 0), yaw = -1.1;
    const s = createLabState(LAB_BIKES.bolinas, pos.clone(), yaw);
    placeBike(s, pos.clone(), yaw);
    s.speed = 3;
    let maxVy = 0;
    for (let i = 0; i < 30; i++) {
      stepLab(s, { steer: 0, throttle: 0.5, hop: null, swipe: null, again: false, crouch: false, climb: false, loose: false, rough: false }, 1 / 60, phys, []);
      maxVy = Math.max(maxVy, s.vy);
    }
    expect(maxVy).toBeLessThan(1);
  });
});

// The Hairpin hillside is up to 10 m high (Nov 7). Found by the final review: slow riders turning at a hairpin slipped
// between the pad's ring rocks, and the top platform had an open side and a gap at its corner; falls of 4-11 m. On the
// hill the sides are open grass slopes (falls of up to 2.6 m measured when ported), so the line is the old bug's 4 m.
describe('the Hairpin hillside: no falling off', () => {
  it('riding into every hairpin pad and round the top platform, slow and steering, nobody drops more than 3 m', async () => {
    const course = buildHill();
    const phys = await createPhysics(course.world);
    const hp = course.trails.hairpin, { switchbacks } = hairpin().marks, turn = Math.PI * HAIRPIN.SR, L = hp.path.length;
    // [name, u, riding up the trail (or back down it)]
    const starts: [string, number, boolean][] = [];
    switchbacks.forEach((sb, i) => {
      starts.push([`pad ${i + 1} from leg ${i + 1}`, sb - 7, true]);
      starts.push([`pad ${i + 1} from leg ${i + 2}`, sb + turn + 7, false]);
    });
    starts.push(['the platform from leg 5', L - 8, true], ['on the platform', L - 1.5, true], ['leaving the platform', L - 1.5, false]);
    const falls: string[] = [];
    for (const [name, u, up] of starts) for (const id of ['hardtail', 'enduro'] as const) for (const steer of [-1, -0.6, -0.3, 0.3, 0.6, 1]) for (const v of [2, 5]) {
      Object.assign(T, DEFAULTS);
      applyBike(id);
      const p0 = trailPoint(hp, u), yaw = hp.path.at(u).yaw + (up ? 0 : Math.PI);
      const pos = new THREE.Vector3(p0.x, castDown(phys, p0.x, p0.y + 5, p0.z, 20)!.height, p0.z);
      const s = createLabState(LAB_BIKES[id], pos.clone(), yaw);
      placeBike(s, pos.clone(), yaw);
      s.speed = v;
      let top = -Infinity;
      for (let i = 0; i < 60 * 6; i++) {
        stepLab(s, { steer, throttle: 0.4, hop: null, swipe: null, again: false, crouch: false, climb: true }, 1 / 60, phys, course.lines);
        if (!s.grounded) top = Math.max(top, s.pos.y);
        else if (top > -Infinity) {
          if (top - s.pos.y > 3) falls.push(`${name}, ${id} steer ${steer} at ${v} m/s: fell ${(top - s.pos.y).toFixed(1)} m at (${s.pos.x.toFixed(1)}, ${s.pos.z.toFixed(1)})`);
          top = -Infinity;
        }
      }
    }
    expect(falls).toEqual([]);
  }, 180_000);
});
