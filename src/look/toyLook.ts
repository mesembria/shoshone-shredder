import * as THREE from 'three';

export interface Look { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; sun: THREE.DirectionalLight }

export const MAX_RATIO = 1.5; // the 10th-generation iPad's screen is 2x; 1.5x keeps 60 fps
const cache = new Map<string, THREE.MeshStandardMaterial>();

// One shared matte material per color: soft, toy-like, and few draw calls once merged.
export function mat(color: number, kind: '' | 'glass' = ''): THREE.MeshStandardMaterial {
  const key = `${color}|${kind}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: kind === 'glass' ? 0.3 : 0.85, metalness: kind === 'glass' ? 0.1 : 0 });
    cache.set(key, m);
  }
  return m;
}

export function createLook(canvas: HTMLCanvasElement): Look {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe9e6df, 140, 620);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 1600);
  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x7a8a50, 1.15));
  const sun = new THREE.DirectionalLight(0xffdcac, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 5, far: 230 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  // A soft fill from the shady side, so house fronts that face away from the sun keep their color.
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.8);
  fill.position.set(40, 30, -30);
  scene.add(fill);
  scene.add(skyDome(0x7aa6de, 0xf4e6d2));
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  return { renderer, scene, camera, sun };
}

// Render resolution drops on its own when frames run slow. The iPad shows at most 60 fps, so a steady
// 16.7 ms is as good as it gets: after five steady seconds, try a little sharper again.
// The first seconds of a place are slow while shaders compile and the backdrop uploads, and every change resizes
// (and so blanks) the canvas: the governor waits those out instead of stepping down on each one.
export const GOVERNOR_WARMUP = 4;
export function createResolutionGovernor(renderer: THREE.WebGLRenderer, maxRatio: number): (dt: number) => void {
  let ratio = renderer.getPixelRatio(), time = 0, frames = 0, calm = 0, warm = GOVERNOR_WARMUP;
  const apply = (r: number) => {
    ratio = r;
    renderer.setPixelRatio(r);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  return (dt) => {
    if (warm > 0) {
      warm -= dt;
      return;
    }
    time += dt;
    frames++;
    if (time < 1) return;
    const ms = (1000 * time) / frames;
    time = frames = 0;
    if (ms > 18.5) {
      calm = 0;
      if (ratio > 0.75) apply(Math.max(0.75, ratio - 0.15));
    } else if (ms < 17.2 && ++calm >= 5) {
      calm = 0;
      if (ratio < maxRatio) apply(Math.min(maxRatio, ratio + 0.05));
    }
  };
}

// Where the sun sits from the rider: low and to the west-south-west, for the foothills' long shadows.
const SUN_OFFSET = new THREE.Vector3(-78, 42, 40);

// The shadow box follows the rider, so shadows stay crisp where the action is.
export function followSun(sun: THREE.DirectionalLight, at: THREE.Vector3): void {
  sun.target.position.copy(at);
  sun.position.copy(at).add(SUN_OFFSET);
}

function skyDome(top: number, horizon: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const pos = geo.attributes.position, ct = new THREE.Color(top), ch = new THREE.Color(horizon), cols: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const c = ch.clone().lerp(ct, Math.pow(Math.max(0, pos.getY(i) / 900), 0.55));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false }));
}
