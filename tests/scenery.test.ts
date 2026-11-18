import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildPlace, type PlaceId } from '../src/world/places';
import { createScenery } from '../src/look/scenery';
import type { Look } from '../src/look/toyLook';
import type { Course } from '../src/lab/course';

const IDS: PlaceId[] = ['shredderHills', 'mesaJumpPark'];

function stubLook(): Look {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight());
  const sun = new THREE.DirectionalLight();
  scene.add(sun);
  return { scene, sun, camera: new THREE.PerspectiveCamera(), renderer: { capabilities: { getMaxAnisotropy: () => 1 } } as unknown as THREE.WebGLRenderer };
}

// every instance of a kind: where it stands
function instances(scene: THREE.Scene, kind: string): THREE.Vector3[] {
  const out: THREE.Vector3[] = [], m = new THREE.Matrix4();
  scene.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || im.userData.kind !== kind) return;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      out.push(new THREE.Vector3().setFromMatrixPosition(m));
    }
  });
  return out;
}

describe.each(IDS)('scenery in %s', (id) => {
  let course: Course, look: Look;
  beforeAll(() => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('no backdrop in tests')));
    course = buildPlace(id);
    look = stubLook();
    createScenery(look, course);
  });

  it('has a plan with an extent, towns and groves', () => {
    const p = course.scenery;
    expect(p.extent.x1).toBeGreaterThan(p.extent.x0);
    expect(p.towns.length).toBeGreaterThan(0);
    expect(p.groves.length).toBeGreaterThan(0);
    for (const s of Object.values(course.stations)) expect(p.clearance(s.pos.x, s.pos.z), 'a station').toBeLessThan(2);
    for (const t of Object.values(course.trails)) {
      const m = t.path.at(t.path.length / 2);
      expect(p.clearance(m.x, m.z), t.id).toBe(0);
    }
  });

  it('keeps pines and boulders 6 m, and tufts, yucca and cactus 2 m, clear', () => {
    const p = course.scenery;
    for (const [kind, min] of [['pine', 6], ['boulder', 6], ['tuft', 2], ['yucca', 2], ['cactus', 2]] as const) {
      const list = instances(look.scene, kind);
      expect(list.length, kind).toBeGreaterThan(0);
      for (const v of list) expect(p.clearance(v.x, v.z), `${kind} at ${v.x.toFixed(1)}, ${v.z.toFixed(1)}`).toBeGreaterThanOrEqual(min);
    }
  });

  it('puts every prairie dog mound within 25 m of a town, 4 m clear', () => {
    const p = course.scenery, mounds = instances(look.scene, 'mound');
    expect(mounds.length).toBeGreaterThan(0);
    for (const v of mounds) {
      expect(p.clearance(v.x, v.z)).toBeGreaterThanOrEqual(4);
      expect(Math.min(...p.towns.map((t) => Math.hypot(t.x - v.x, t.z - v.z)))).toBeLessThan(25);
    }
  });

  it('gives every pine and boulder inside the boundary a collider', () => {
    const { bound: e } = course.scenery;
    const inside = (v: THREE.Vector3) => v.x >= e.x0 && v.x <= e.x1 && v.z >= e.z0 && v.z <= e.z1;
    const count = (kind: string) => {
      let n = 0;
      course.world.traverse((o) => { if (o.userData.scenery === kind && o.userData.collide === 'wall') n++; });
      return n;
    };
    expect(count('pine')).toBe(instances(look.scene, 'pine').filter(inside).length);
    expect(count('boulder')).toBe(instances(look.scene, 'boulder').filter(inside).length);
  });

  it('stands things on the ground', () => {
    const { ground, bound: e } = course.scenery;
    for (const v of instances(look.scene, 'pine')) if (v.x > e.x0 && v.x < e.x1 && v.z > e.z0 && v.z < e.z1) expect(Math.abs(v.y - (ground(v.x, v.z) - 0.1))).toBeLessThan(1e-4);
  });

  it('gives every pine and boulder inside the boundary a collider at its own spot', () => {
    const { bound: b } = course.scenery, spots = new Map<string, THREE.Vector3[]>();
    course.world.traverse((o) => {
      if (o.userData.collide !== 'wall' || !o.userData.scenery) return;
      const l = spots.get(o.userData.scenery) ?? [];
      l.push(o.position.clone());
      spots.set(o.userData.scenery, l);
    });
    for (const kind of ['pine', 'boulder']) {
      const mine = instances(look.scene, kind).filter((v) => v.x >= b.x0 && v.x <= b.x1 && v.z >= b.z0 && v.z <= b.z1);
      expect(mine.length, kind).toBeGreaterThan(0);
      for (const v of mine) expect(spots.get(kind)!.some((c) => Math.hypot(c.x - v.x, c.z - v.z) < 1e-4), `${kind} at ${v.x.toFixed(1)}, ${v.z.toFixed(1)}`).toBe(true);
    }
  });

  it('keeps the visual land at the collision ground inside the boundary, and rises only past it', () => {
    const { bound: b, extent: e, ground } = course.scenery;
    let land: THREE.Mesh | undefined;
    look.scene.traverse((o) => { if (o.userData.kind === 'land') land = o as THREE.Mesh; });
    const pos = land!.geometry.getAttribute('position');
    let inside = 0, risen = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) {
        inside++;
        // under the place's own surface inside the extent (it never shows); at the collision ground between extent and boundary
        const inExtent = x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1;
        if (inExtent) expect(y).toBeLessThanOrEqual(ground(x, z));
        else expect(Math.abs(y - (ground(x, z) - 0.06)), `land at ${x.toFixed(0)}, ${z.toFixed(0)}`).toBeLessThan(0.04);
      } else if (y > 1) risen++;
    }
    expect(inside).toBeGreaterThan(0);
    expect(risen).toBeGreaterThan(0);
  });

  it('stands a wall on each side of the boundary', () => {
    const { bound: b } = course.scenery, walls: THREE.Mesh[] = [];
    course.world.traverse((o) => { if (o.userData.scenery === 'boundary') walls.push(o as THREE.Mesh); });
    expect(walls).toHaveLength(4);
    const box = new THREE.Box3();
    const sides = { w: false, e: false, n: false, s: false };
    for (const m of walls) {
      expect(m.userData.collide).toBe('wall');
      box.setFromObject(m);
      expect(box.max.y).toBeGreaterThanOrEqual(3);
      const c = box.getCenter(new THREE.Vector3());
      if (Math.abs(c.x - b.x0) < 1) sides.w = true;
      if (Math.abs(c.x - b.x1) < 1) sides.e = true;
      if (Math.abs(c.z - b.z0) < 1) sides.n = true;
      if (Math.abs(c.z - b.z1) < 1) sides.s = true;
    }
    expect(Object.values(sides)).toEqual([true, true, true, true]);
  });
});
