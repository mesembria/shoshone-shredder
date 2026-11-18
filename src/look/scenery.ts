// The foothills look, in both places: a Nano Banana painting of the mountains on a far curved backdrop to the west (+x,
// the way the jump lanes and the street run), golden grass, rolling hills past the place's edge, ponderosa pines, grass
// tufts that sway, yucca, prickly pear, sandstone boulders, prairie dogs that duck when you ride close, a hawk, and a
// lower, warmer sun. Where things may stand comes from the course's SceneryPlan (clearance, towns, groves); pines and
// boulders inside its extent are solid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from './palette';
import { mat, type Look } from './toyLook';
import type { Course } from '../lab/course';
import { rng } from '../world/rng';

export interface Scenery { update(dt: number, at: THREE.Vector3): void }

const GOLD = 0xc8b76c;
const HAZE = 0xeee2cf; // fog and the sky's horizon
const SPAN = THREE.MathUtils.degToRad(80); // the backdrop's slice of the view, centered on +x
const SQUASH = 0.8; // painted peaks come out taller than asked; flatten a little rather than tower
const R_BACK = 640;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, z: number) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;

// 1 toward the painted mountains, 0 elsewhere: the game's own far hills stay low there so the painting shows. With
// north and south pictures the painting covers about ±96°; its far ends are low hills that meet these.
const westness = (dx: number, dz: number) => 1 - smooth(THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(100), Math.abs(Math.atan2(dz, dx)));

// Ground height past the place's boundary: flat at the wall, rising from its foot to rolling land, a rim of hills far
// away. `out` is how far (x, z) is outside the boundary; (dx, dz) is its offset from the extent's middle, for which way is west.
function groundOutside(out: number, x: number, z: number, dx: number, dz: number): number {
  const roll = smooth(0, 80, out) * (1.5 + 7 * fbm(x / 60, z / 60));
  const rim = smooth(260, 480, out) * (10 + 38 * fbm(x / 120 + 7, z / 120)) * (1 - 0.8 * westness(dx, dz));
  return roll + rim;
}

// Geometry with one flat color per piece, so several pieces merge into one draw.
function colored(geo: THREE.BufferGeometry, hex: number, shade?: (y: number) => number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position'), c = new THREE.Color(hex), cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = shade ? shade(pos.getY(i)) : 1;
    cols.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'color') g.deleteAttribute(n);
  return g;
}
const merge = (geos: THREE.BufferGeometry[]) => mergeGeometries(geos)!;
const flatMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

interface Put { x: number; y: number; z: number; s: number; r: number; c?: THREE.Color }
function instanced(geo: THREE.BufferGeometry, material: THREE.Material, list: Put[], cast: boolean): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  m.count = list.length;
  const o = new THREE.Object3D();
  list.forEach((p, i) => {
    o.position.set(p.x, p.y, p.z);
    o.rotation.set(0, p.r, 0);
    o.scale.setScalar(p.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (p.c) m.setColorAt(i, p.c);
  });
  m.castShadow = cast;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

// ---- the pieces ----

function pineGeo(): THREE.BufferGeometry {
  return merge([
    colored(new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6).translate(0, 1.3, 0), 0x8a5a3a),
    colored(new THREE.ConeGeometry(1.5, 2.8, 7).translate(0, 3.1, 0), 0x2f4a2e),
    colored(new THREE.ConeGeometry(1.15, 2.4, 7).translate(0, 4.4, 0), 0x35523a),
    colored(new THREE.ConeGeometry(0.7, 1.8, 7).translate(0, 5.6, 0), 0x3b5b3c),
  ]);
}
function tuftGeo(): THREE.BufferGeometry {
  const r = rng(7), blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.45 + r() * 0.35, a = (i / 6) * Math.PI * 2 + r();
    const b = new THREE.ConeGeometry(0.045, h, 3, 1, true).translate(0, h / 2, 0);
    b.rotateZ(0.25 + r() * 0.25).rotateY(a).translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    blades.push(colored(b, 0xffffff, (y) => 0.7 + 0.3 * Math.min(1, y / 0.7)));
  }
  return merge(blades);
}
function yuccaGeo(): THREE.BufferGeometry {
  const r = rng(11), spikes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3, tilt = 0.25 + r() * 0.9, h = 0.55 + r() * 0.25;
    spikes.push(colored(new THREE.ConeGeometry(0.04, h, 3, 1, true).translate(0, h / 2, 0).rotateZ(tilt).rotateY(a), 0x6f7f3a));
  }
  return merge(spikes);
}
function cactusGeo(): THREE.BufferGeometry {
  const pad = (x: number, y: number, rz: number, ry: number, s = 1) =>
    colored(new THREE.IcosahedronGeometry(1, 0).scale(0.3 * s, 0.26 * s, 0.07).rotateZ(rz).rotateY(ry).translate(x, y, 0), 0x7a9440);
  const bloom = (x: number, y: number) => colored(new THREE.IcosahedronGeometry(0.05, 0).translate(x, y, 0), 0xf2d14b);
  return merge([pad(0, 0.22, 0, 0), pad(0.26, 0.46, -0.5, 0.4, 0.85), pad(-0.24, 0.44, 0.5, -0.3, 0.8), pad(0.04, 0.68, 0.1, 0.2, 0.7), bloom(0.3, 0.68), bloom(-0.06, 0.88)]);
}
function boulderGeo(): THREE.BufferGeometry {
  return colored(new THREE.DodecahedronGeometry(1, 0).scale(1, 0.62, 0.85).translate(0, 0.25, 0), 0xffffff);
}

// ---- the backdrop ----

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (typeof Image === 'undefined') return res(null);
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 0 ? img : null);
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Until the Nano Banana picture is in public/backdrop/, a plain painted range so the test runs.
function standIn(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const W = 4096, H = 1000, c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d'), r = rng(3);
  if (!g) return null;
  const env = (x: number) => Math.pow(Math.sin(Math.PI * x / W), 0.8);
  // peaks: lit and shaded faces, snow above a line
  let x = -100;
  while (x < W + 100) {
    const w = 140 + r() * 220, peak = x + w / 2, ph = H - (180 + (520 + r() * 260) * env(peak));
    g.fillStyle = '#8f9fb6';
    g.beginPath(); g.moveTo(x, H); g.lineTo(peak, ph); g.lineTo(peak, H); g.fill();
    g.fillStyle = '#74849c';
    g.beginPath(); g.moveTo(peak, ph); g.lineTo(x + w, H); g.lineTo(peak, H); g.fill();
    const snow = (H - ph) * 0.28;
    if (H - ph > 420) {
      g.fillStyle = '#f4f6f8';
      g.beginPath(); g.moveTo(peak, ph); g.lineTo(peak - (w / 2) * (snow / (H - ph)), ph + snow); g.lineTo(peak, ph + snow * 0.8); g.lineTo(peak + (w / 2) * (snow / (H - ph)) * 0.7, ph + snow * 0.9); g.fill();
    }
    x += w * 0.55;
  }
  // forested foothills
  g.fillStyle = '#3f5a38';
  g.beginPath(); g.moveTo(0, H);
  for (let i = 0; i <= 64; i++) { const xx = (i / 64) * W; g.lineTo(xx, H - 150 - 170 * env(xx) * (0.7 + 0.3 * Math.sin(i * 1.7))); }
  g.lineTo(W, H); g.fill();
  // the Flatirons, in the right third
  for (let i = 0; i < 4; i++) {
    const bx = W * 0.66 + i * 120, bh = 300 - i * 40;
    g.fillStyle = i % 2 ? '#c98b6a' : '#b47a5c';
    g.beginPath(); g.moveTo(bx, H - 140); g.lineTo(bx + 70, H - 140 - bh); g.lineTo(bx + 130, H - 140); g.fill();
  }
  // golden grassland along the bottom
  g.fillStyle = '#c8b76c';
  g.beginPath(); g.moveTo(0, H);
  for (let i = 0; i <= 32; i++) { const xx = (i / 32) * W; g.lineTo(xx, H - 90 - 30 * Math.sin(i * 0.9)); }
  g.lineTo(W, H); g.fill();
  return c;
}

interface Baked { width: number; height: number; center: number; westW: number; chunks: { file: string; x: number; w: number }[] }

// The painting, baked by scripts/bake-backdrop.ts into pieces at most MAX_TEX wide (magenta cut, joined, hazed).
// Without a bake, the plain stand-in.
async function backdrop(parent: THREE.Object3D, maxAniso: number): Promise<void> {
  let info: Baked | null = null;
  try {
    const res = await fetch('/backdrop/baked/info.json');
    if (res.ok) info = (await res.json()) as Baked;
  } catch {
    info = null;
  }
  const pieces: { src: TexImageSource; x: number; w: number }[] = [];
  if (info) {
    const imgs = await Promise.all(info.chunks.map((c) => loadImage(`/backdrop/baked/${c.file}`)));
    info.chunks.forEach((c, i) => { if (imgs[i]) pieces.push({ src: imgs[i]!, x: c.x, w: c.w }); });
  } else {
    const c = standIn();
    if (!c) return;
    info = { width: c.width, height: c.height, center: c.width / 2, westW: c.width, chunks: [] };
    pieces.push({ src: c, x: 0, w: c.width });
  }
  const perPx = SPAN / info.westW; // west's picture covers SPAN; the others share its scale
  const h = info.height * perPx * R_BACK * SQUASH;
  // a cylinder piece per texture; strip x grows to the viewer's left when facing west
  for (const { src, x, w } of pieces) {
    const tex = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.repeat.x = -1; // seen from inside the cylinder
    tex.offset.x = 1;
    const thetaB = Math.PI / 2 + (info.center - (x + w)) * perPx, len = w * perPx;
    const geo = new THREE.CylinderGeometry(R_BACK, R_BACK, h, Math.max(8, Math.ceil(len / 0.02)), 1, true, thetaB, len);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    m.position.y = h / 2 - 6;
    m.renderOrder = -1;
    parent.add(m);
  }
}

// ---- putting it together ----

export function createScenery(look: Look, course: Course): Scenery {
  const { scene, renderer } = look, plan = course.scenery, e = plan.extent, bd = plan.bound;
  // light and air: a warmer sun, warm haze, golden grass in place of lawn green (the sun sits lower: see SUN_OFFSET)
  look.sun.color.set(0xffd29a);
  scene.fog = new THREE.Fog(HAZE, 150, 1000);
  scene.traverse((o) => {
    if ((o as THREE.HemisphereLight).isHemisphereLight) (o as THREE.HemisphereLight).groundColor.set(0x9c8a55);
  });
  mat(C.lawn).color.set(GOLD);

  const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
  const inBound = (x: number, z: number) => x >= bd.x0 && x <= bd.x1 && z >= bd.z0 && z <= bd.z1;
  const outOf = (x: number, z: number) => Math.hypot(Math.max(0, bd.x0 - x, x - bd.x1), Math.max(0, bd.z0 - z, z - bd.z1));
  const yAt = (x: number, z: number) => (inBound(x, z) ? plan.ground(x, z) : groundOutside(outOf(x, z), x, z, x - cx, z - cz) - 0.06);

  // the land past the extent: rolling, flat-shaded, gold with sage and dry patches (flat under the extent itself, where
  // the place's own ground is)
  {
    const geo = new THREE.PlaneGeometry(1400, 1400, 140, 140).rotateX(-Math.PI / 2).translate(cx, 0, cz).toNonIndexed();
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, groundOutside(outOf(x, z), x, z, x - cx, z - cz) - 0.06);
    }
    const cols = new Float32Array(pos.count * 3), gold = new THREE.Color(GOLD), sage = new THREE.Color(0xa3a675), dry = new THREE.Color(0xd8c98a), c = new THREE.Color();
    for (let f = 0; f < pos.count; f += 3) {
      const x = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, z = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
      const n = fbm(x / 40, z / 40);
      c.copy(gold).lerp(n > 0.55 ? sage : dry, Math.abs(n - 0.5) * 1.6);
      for (let v = 0; v < 3; v++) cols.set([c.r, c.g, c.b], (f + v) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.deleteAttribute('uv');
    geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, flatMat());
    land.userData.kind = 'land';
    land.receiveShadow = true;
    scene.add(land);
  }

  // scatter: tufts need 2 m clear, yucca and cactus 2 m, pines and boulders 6 m
  const r = rng(plan.seed);
  const tint = (lo: number, hi: number) => { const v = lo + r() * (hi - lo); return new THREE.Color(v, v, v); };
  const pines: Put[] = [], tufts: Put[] = [], yuccas: Put[] = [], cacti: Put[] = [], boulders: Put[] = [];
  const grassCols = [new THREE.Color(0xd9c77a), new THREE.Color(0xc2b062), new THREE.Color(0xa9ad72), new THREE.Color(0xe3d49a)];
  const around = (m: number) => [e.x0 - m + r() * (e.x1 - e.x0 + 2 * m), e.z0 - m + r() * (e.z1 - e.z0 + 2 * m)];
  // grass: patchy meadows over the extent and 100 m past it
  for (let i = 0; i < 26000 && tufts.length < 6000; i++) {
    const [x, z] = around(100);
    if (plan.clearance(x, z) < 2 || fbm(x / 18, z / 18) < 0.42) continue;
    tufts.push({ x, y: yAt(x, z), z, s: 0.8 + r() * 0.9, r: r() * 6.28, c: grassCols[Math.floor(r() * 4)] });
  }
  // pines in the plan's groves
  for (const g of plan.groves) for (let k = 0; k < g.n; k++) {
    const x = g.x + (r() - 0.5) * 2 * g.r, z = g.z + (r() - 0.5) * 2 * g.r;
    if (plan.clearance(x, z) >= 6) pines.push({ x, y: yAt(x, z) - 0.1, z, s: 0.8 + r() * 1.0, r: r() * 6.28, c: tint(0.85, 1.15) });
  }
  for (let i = 0; i < 900; i++) {
    const [x, z] = around(150);
    const kind = r(), cl = plan.clearance(x, z);
    if (kind < 0.4 && cl >= 2) yuccas.push({ x, y: yAt(x, z), z, s: 0.8 + r() * 0.6, r: r() * 6.28 });
    else if (kind < 0.75 && cl >= 2) cacti.push({ x, y: yAt(x, z), z, s: 0.8 + r() * 0.7, r: r() * 6.28 });
    else if (kind >= 0.75 && cl >= 6) boulders.push({ x, y: yAt(x, z) - 0.2, z, s: 0.5 + r() * 1.6, r: r() * 6.28, c: new THREE.Color().setHSL(0.09 + r() * 0.03, 0.35, 0.68 + r() * 0.12) });
  }

  // pines and boulders inside the extent are solid: invisible copies join the course before its physics is built
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const rockHull = boulderGeo();
  const solid = (geo: THREE.BufferGeometry, kind: string, x: number, y: number, z: number, ry = 0, s = 1) => {
    const m = new THREE.Mesh(geo, hidden);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.scale.setScalar(s);
    m.userData.collide = 'wall';
    m.userData.scenery = kind;
    course.world.add(m);
  };
  // the place ends at its boundary: four thin walls, 3 m above the ground, stop the bike there
  const wall = (x0: number, x1: number, z0: number, z1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 4, z1 - z0), hidden);
    m.position.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2);
    m.userData.collide = 'wall';
    m.userData.scenery = 'boundary';
    course.world.add(m);
  };
  wall(bd.x0 - 1, bd.x1 + 1, bd.z0 - 1, bd.z0);
  wall(bd.x0 - 1, bd.x1 + 1, bd.z1, bd.z1 + 1);
  wall(bd.x0 - 1, bd.x0, bd.z0, bd.z1);
  wall(bd.x1, bd.x1 + 1, bd.z0, bd.z1);
  const trunk = new THREE.CylinderGeometry(0.32, 0.32, 3.2, 6);
  for (const p of pines) if (inBound(p.x, p.z)) solid(trunk, 'pine', p.x, p.y + 1.6 * p.s, p.z, 0, p.s);
  for (const p of boulders) if (inBound(p.x, p.z)) solid(rockHull, 'boulder', p.x, p.y, p.z, p.r, p.s);

  const grassMat = flatMat();
  const uTime = { value: 0 };
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix[3];
      float sway = transformed.y * transformed.y;
      transformed.x += sway * 0.35 * sin(uTime * 1.9 + ip.x * 0.31 + ip.z * 0.17);
      transformed.z += sway * 0.2 * sin(uTime * 1.3 + ip.x * 0.13 - ip.z * 0.29);`);
  };
  // only things near the park cast shadows (the shadow box is 80 m and follows the rider)
  const near = (p: Put) => outOf(p.x, p.z) < 30;
  const pine = pineGeo(), pineMat = flatMat(), rock = boulderGeo(), rockMat = flatMat();
  const tag = (kind: string, m: THREE.InstancedMesh) => { m.userData.kind = kind; return m; };
  scene.add(
    tag('pine', instanced(pine, pineMat, pines.filter(near), true)),
    tag('pine', instanced(pine, pineMat, pines.filter((p) => !near(p)), false)),
    tag('tuft', instanced(tuftGeo(), grassMat, tufts, false)),
    tag('yucca', instanced(yuccaGeo(), flatMat(), yuccas, false)),
    tag('cactus', instanced(cactusGeo(), flatMat(), cacti, false)),
    tag('boulder', instanced(rock, rockMat, boulders.filter(near), true)),
    tag('boulder', instanced(rock, rockMat, boulders.filter((p) => !near(p)), false)),
  );

  // prairie dogs: the plan's towns, seven burrows each, on open ground (4 m clear of anything)
  const dogs: { x: number; z: number; y: number; up: number; wait: number; turn: number }[] = [];
  for (const t of plan.towns) {
    for (let k = 0; k < 7; k++) {
      const dx = t.x + (r() - 0.5) * 12, dz = t.z + (r() - 0.5) * 12;
      if (plan.clearance(dx, dz) >= 4) dogs.push({ x: dx, z: dz, y: yAt(dx, dz), up: 1, wait: r() * 3, turn: r() * 6.28 });
    }
  }
  const mounds = instanced(colored(new THREE.ConeGeometry(0.5, 0.22, 8).translate(0, 0.11, 0), 0x9e7f5c), flatMat(), dogs.map((d) => ({ x: d.x, y: d.y, z: d.z, s: 1, r: 0 })), false);
  mounds.userData.kind = 'mound';
  const dogGeo = merge([
    colored(new THREE.CapsuleGeometry(0.085, 0.2, 3, 6).translate(0, 0.19, 0), 0xb58d5e),
    colored(new THREE.SphereGeometry(0.075, 6, 5).translate(0, 0.4, 0.02), 0xb58d5e),
    colored(new THREE.SphereGeometry(0.02, 4, 3).translate(0.03, 0.42, 0.085), 0x2a2a2e),
    colored(new THREE.SphereGeometry(0.02, 4, 3).translate(-0.03, 0.42, 0.085), 0x2a2a2e),
  ]);
  const dogMesh = new THREE.InstancedMesh(dogGeo, flatMat(), Math.max(1, dogs.length));
  dogMesh.count = dogs.length;
  dogMesh.castShadow = true;
  dogMesh.frustumCulled = false;
  scene.add(mounds, dogMesh);

  // a hawk circling high over wherever you ride
  const hawk = new THREE.Group();
  const hawkMat = flatMat();
  const body = new THREE.Mesh(colored(new THREE.ConeGeometry(0.18, 1.1, 5).rotateX(Math.PI / 2), 0x6b4e36), hawkMat);
  const wing = (side: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, side * 1.3, 0, -0.1, 0, 0, -0.25, 0, 0, 0.3, 0, 0, -0.25, side * 1.3, 0, -0.1], 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(colored(g, 0x5a4230), hawkMat);
    (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    return m;
  };
  const wl = wing(1), wr = wing(-1);
  hawk.add(body, wl, wr);
  hawk.scale.setScalar(1.6);
  scene.add(hawk);
  const hawkCenter = new THREE.Vector3();
  let clock = 0, first = true;

  // the painting stands round the extent's middle
  const back = new THREE.Group();
  back.position.set(cx, 0, cz);
  scene.add(back);
  backdrop(back, renderer.capabilities.getMaxAnisotropy()).catch(() => {});

  const o = new THREE.Object3D();
  return {
    update(dt, at) {
      clock += dt;
      uTime.value = clock;
      // prairie dogs duck fast when you ride within 14 m, then pop back up a while after you've gone
      dogs.forEach((d, i) => {
        const near = Math.hypot(at.x - d.x, at.z - d.z) < 14;
        if (near) {
          d.up = Math.max(0, d.up - dt * 7);
          d.wait = 1.5 + hash(i, clock) * 3;
        } else if (d.wait > 0) d.wait -= dt;
        else d.up = Math.min(1, d.up + dt * 1.6);
        d.turn += Math.sin(clock * 0.7 + i) * dt * 0.8;
        o.position.set(d.x, d.y - 0.45 + d.up * 0.47, d.z);
        o.rotation.set(0, d.turn, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        dogMesh.setMatrixAt(i, o.matrix);
      });
      dogMesh.instanceMatrix.needsUpdate = true;
      // the hawk: a slow circle 45 m up, its center drifting after you
      if (first) hawkCenter.copy(at);
      first = false;
      hawkCenter.lerp(at, 1 - Math.exp(-dt * 0.08));
      const a = clock * 0.3, R = 38;
      hawk.position.set(hawkCenter.x + Math.cos(a) * R, 45 + Math.sin(clock * 0.21) * 4, hawkCenter.z + Math.sin(a) * R);
      hawk.rotation.set(0, -a, 0.35, 'YXZ');
      const flap = (clock % 9) < 1.4 ? Math.sin(clock * 11) * 0.5 : 0.12;
      wl.rotation.z = flap;
      wr.rotation.z = -flap;
    },
  };
}
