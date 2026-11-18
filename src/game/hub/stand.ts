// The Garage's stand: one small three.js view of a bike, rider astride it with a foot down, on a turntable in soft
// studio light. It uses the same rig the game rides, in its one-shot standPose(), and never calls rig.update() (that
// would undo the pose). Drag to spin it, with a little fling; left alone it turns slowly by itself. anchor(slot) gives
// the screen point of a slot's part, for the Garage's hotspot dots.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRider, type AnchorName, type RiderRig } from '../../bike/rider';
import { MAX_RATIO } from '../../look/toyLook';
import type { Loadout, Slot } from '../catalog';

export interface Stand {
  show(l: Loadout): void; // a new bike or loadout rebuilds the rig; the same one with new paint only repaints
  setRider(v: boolean): void;
  spin(rad: number): void; // turns the stand by rad, as a drag would
  anchor(slot: Slot): { x: number; y: number; behind: boolean } | null; // canvas CSS px; behind: round the far side
  dispose(): void;
  frameColor(): number; riderVisible(): boolean; bike(): string; // for the browser check
}

const ANCHOR: Record<Slot, AnchorName> = { suspension: 'fork', tires: 'frontTire', brakes: 'rearHub', cockpit: 'bars', drivetrain: 'cranks' };
const TOP = 0.09; // the turntable's top, above the floor
const IDLE_AFTER = 2.5, IDLE_SPEED = 0.22; // s untouched, rad/s
const START = -0.55; // a three-quarter view from the front
const HIDDEN = 0.36; // m past the spindle before a part counts as round the far side

export function createStand(canvas: HTMLCanvasElement, opts: { onFrame?: () => void } = {}): Stand {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_RATIO));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);

  // studio light: a warm key overhead that casts the only shadow, a cool rim from behind to pick out the frame's
  // edges, a soft fill so the shady side keeps its color
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5b4a40, 1.0));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.3);
  key.position.set(1.8, 5, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 1, far: 12 });
  key.shadow.bias = -0.0005;
  key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xcfe6ff, 1.6);
  rim.position.set(-3, 2.6, -3.2);
  const fill = new THREE.DirectionalLight(0xffe6c4, 0.55);
  fill.position.set(-3, 1.2, 3);
  scene.add(key, key.target, rim, fill);

  // the turntable: a cream top with a yellow rim and studs round the edge, so you can see it turn
  const table = new THREE.Group();
  scene.add(table);
  const owned: THREE.BufferGeometry[] = [];
  const mesh = (g: THREE.BufferGeometry, color: number, rough = 0.75) => {
    owned.push(g);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
    m.receiveShadow = true;
    return m;
  };
  const R = 1.02;
  table.add(mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.96, 0.05, 48).translate(0, 0.025, 0), 0x2f3d2e, 0.9)); // the base
  table.add(mesh(new THREE.CylinderGeometry(R, R, 0.035, 64).translate(0, TOP - 0.0175, 0), 0xffd84a, 0.6)); // the rim
  table.add(mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.01, 64).translate(0, TOP + 0.003, 0), 0xf3e6c8, 0.85)); // the top
  const studs = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return new THREE.CylinderGeometry(0.026, 0.026, 0.012, 10).translate(Math.cos(a) * (R - 0.09), TOP + 0.01, Math.sin(a) * (R - 0.09));
  });
  table.add(mesh(mergeGeometries(studs), 0xc9a227, 0.5));
  studs.forEach((g) => g.dispose());

  let rig: RiderRig | null = null, shown: Loadout | null = null, color = 0, riderOn = true;
  let angle = START, vel = 0, idle = 0, dragging = false;

  function dropRig(): void {
    if (!rig) return;
    table.remove(rig.root);
    rig.root.traverse((m) => {
      if (m instanceof THREE.Mesh) m.geometry.dispose(); // not the materials: mat() shares them
    });
    rig = null;
  }

  // frame the bike and rider as close as fits: the whole turning bike, whatever way it faces
  const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
  let fitH = 1.8, fitL = 1.8;
  function frame(): void {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    camera.aspect = w / h;
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), ht = vt * camera.aspect;
    const dist = Math.max((fitH / 2) / vt, (fitL / 2) / ht) * 1.06 + fitL * 0.3; // the near end swings closer
    const look = new THREE.Vector3(0, TOP + fitH * 0.45, 0);
    camera.position.set(0, look.y + dist * 0.16, dist);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  }

  function build(l: Loadout): void {
    dropRig();
    rig = createRider(l.spec);
    rig.standPose();
    rig.setRiderVisible(riderOn);
    color = l.spec.frameColor;
    rig.root.traverse((m) => {
      if (m instanceof THREE.Mesh) m.castShadow = true;
    });
    table.add(rig.root);
    // stand it on the turntable, its middle over the spindle (measured with the table square on)
    table.rotation.y = 0;
    rig.root.position.set(0, 0, 0);
    table.updateMatrixWorld(true);
    box.setFromObject(rig.root);
    box.getSize(size);
    // the spindle under the middle of the wheelbase (the box's middle leans forward with the rider's head)
    const a = rig.anchors();
    a.rearHub.getWorldPosition(mid);
    const rearX = mid.x;
    a.frontTire.getWorldPosition(mid);
    rig.root.position.set(-(rearX + mid.x - l.spec.wheelRadius) / 2, TOP - box.min.y, 0);
    fitH = size.y + TOP;
    fitL = Math.max(size.x, 1.4);
    table.rotation.y = angle;
    frame();
  }

  const sameParts = (a: Loadout, b: Loadout) => a.bike === b.bike && JSON.stringify(a.fitted) === JSON.stringify(b.fitted);

  // ---- drag to spin (touch and mouse), with a fling that dies away
  let lastX = 0, lastT = 0, pointer = -1;
  const down = (e: PointerEvent) => {
    if (pointer >= 0) return;
    pointer = e.pointerId;
    dragging = true;
    vel = 0;
    lastX = e.clientX;
    lastT = performance.now();
    try {
      canvas.setPointerCapture(e.pointerId); // keeps the drag when a finger slides off the canvas
    } catch {
      // a pointer the browser no longer tracks: the drag still works while it stays on the canvas
    }
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    const dx = e.clientX - lastX, now = performance.now(), dt = Math.max(1, now - lastT) / 1000;
    angle += dx * 0.011;
    vel = 0.6 * vel + 0.4 * ((dx * 0.011) / dt);
    lastX = e.clientX;
    lastT = now;
    idle = 0;
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    dragging = false;
    if (performance.now() - lastT > 80) vel = 0; // held still before letting go: no fling
    vel = THREE.MathUtils.clamp(vel, -9, 9);
    idle = 0;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const ro = new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    frame();
  });
  ro.observe(canvas);

  // ---- the loop
  let raf = 0, last = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const real = (now - last) / 1000, dt = Math.min(0.05, real);
    last = now;
    if (!dragging) {
      idle += real;
      angle += vel * dt;
      vel *= Math.exp(-3 * dt);
      if (Math.abs(vel) < 0.05) vel = 0;
      // the idle turn eases in, so it never jerks after a drag
      if (idle > IDLE_AFTER) angle += IDLE_SPEED * Math.min(1, (idle - IDLE_AFTER) / 1.5) * dt;
    }
    table.rotation.y = angle;
    renderer.render(scene, camera);
    opts.onFrame?.();
  };
  raf = requestAnimationFrame(tick);

  const v = new THREE.Vector3(), w = new THREE.Vector3(), flat = new THREE.Vector3();
  return {
    show(l) {
      if (shown && rig && sameParts(shown, l)) {
        if (l.spec.frameColor !== color) rig.setColor((color = l.spec.frameColor));
      } else build(l);
      shown = l;
    },
    setRider(on) {
      riderOn = on;
      rig?.setRiderVisible(on);
    },
    spin(rad) {
      angle += rad;
      idle = 0;
    },
    anchor(slot) {
      if (!rig) return null;
      rig.anchors()[ANCHOR[slot]].getWorldPosition(v);
      // a cheap depth test: the parts all sit on the bike's centre line, so one is hidden (behind the rider's body or
      // the frame) only when it is well past the spindle along the bike's length, seen from the camera's side. Along
      // the length only: the stand pose leans the bike onto the foot, which moves every part sideways.
      table.worldToLocal(w.copy(v));
      table.worldToLocal(flat.copy(camera.position));
      const behind = (w.x * flat.x) / Math.hypot(flat.x, flat.z) < -HIDDEN;
      v.project(camera);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight, behind };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      dropRig();
      table.traverse((m) => {
        if (m instanceof THREE.Mesh) (m.material as THREE.Material).dispose();
      });
      owned.forEach((g) => g.dispose());
      renderer.dispose();
      renderer.forceContextLoss(); // Safari keeps only a few WebGL contexts alive
    },
    frameColor: () => color,
    riderVisible: () => riderOn,
    bike: () => shown?.bike ?? '',
  };
}
