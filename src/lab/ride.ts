// The riding engine shared by the feel lab and the game: the course, the bike, the rider, the camera, the
// controls you can see, sound, effects and the fixed-step loop. Pages add what's theirs through hooks: the lab
// its tuning panel, the game its challenges, bolts and trick locks.
import * as THREE from 'three';
import type { BikeSpec } from '../rules/bikes';
import { TRICK_INFO } from '../rules/tricks';
import { createLook, createResolutionGovernor, followSun, MAX_RATIO, type Look } from '../look/toyLook';
import { mergeStatic } from '../world/build';
import { createPhysics, castDown, spawnTumble, removeTumble, type Physics, type Tumble } from '../world/physics';
import { createRider } from '../bike/rider';
import { forward } from '../bike/controller';
import { createPad, bindPad, type Pad, type Thumb } from '../input/controls';
import { createHud, calloutFor, type Hud } from '../view/hud';
import { createSpeedRing, mph } from './speed-ring';
import { createFx } from '../view/fx';
import type { Sound } from '../view/sound';
import type { Course } from './course';
import { buildPlace, type PlaceId } from '../world/places';
import { createScenery } from '../look/scenery';
import { createLabState, placeBike, resetRide, stepLab, MOVE_INFO, type LabEvents, type LabIntent, type LabState } from './bike';
import { createLabCam } from './camera';
import { segmentsCross } from '../game/spots';
import { inZone, inZoneHeading, type Zone, ledgeAhead, ledgeGate } from '../world/trail';
import { T } from './tune';
import { createControls, guardTouches, stickHome, type Controls } from './touch';

const STEP = 1 / 60, MAX_STEPS = 6;
export { mph } from './speed-ring';
export type RideEvents = LabEvents & { tumbleStart?: boolean; tumbleEnd?: boolean };

export interface RideHooks {
  intent?(i: LabIntent, s: LabState): void; // change the input before each step (the game's trick locks)
  step?(ev: RideEvents, s: LabState): void; // after each fixed step
  gate?(index: number): void; // a slalom gate ridden through
  frame?(dt: number, now: number): void; // once a frame, after the step, before drawing
}
export interface RideOptions {
  bike: BikeSpec;
  start: string; // station name
  overlay: HTMLElement; // where the controls and readouts go
  sound: Sound;
  timeScale?: number;
  autoLand?: boolean;
  debug?: boolean;
  place: PlaceId; // which place to ride: the hill or the jump park
  hooks?: RideHooks;
}
export interface Ride {
  s: LabState;
  course: Course;
  phys: Physics;
  look: Look;
  pad: Pad;
  hud: Hud;
  controls: Controls;
  teleport(name: string): void;
  setBike(spec: BikeSpec): void; // a different bike, right here, at the same speed
  setPaused(p: boolean): void;
  paused(): boolean;
}

// Left thumb: a stick fixed on the left (stickFixed), or one that starts where the thumb lands. Steering gets an expo curve for fine control near the
// middle; up/down ignores some travel while steering, since a thumb sweeping sideways drifts down.
function shapeStick(L: Thumb): { steer: number; throttle: number } {
  const R = T.stickRange, dead = 6;
  if (T.stickFixed) {
    const home = stickHome();
    L.x0 = home.x;
    L.y0 = home.y;
  }
  let dx = L.x - L.x0, dy = L.y - L.y0;
  const d = Math.hypot(dx, dy);
  if (T.stickFollow && !T.stickFixed && d > R) {
    // the stick's middle follows the thumb, so reversing never needs a long slide back
    L.x0 = L.x - (dx * R) / d;
    L.y0 = L.y - (dy * R) / d;
    dx = L.x - L.x0;
    dy = L.y - L.y0;
  }
  const ax = Math.min(1, Math.max(0, Math.abs(dx) - dead) / (R - dead));
  const deadV = dead + T.stickArc * Math.abs(dx);
  const ay = Math.min(1, Math.max(0, Math.abs(dy) - deadV) / (R - dead));
  return { steer: Math.sign(dx) * Math.pow(ax, T.steerExpo), throttle: -Math.sign(dy) * ay };
}

// 360s and backflips turn the whole rider and bike: a spin about the vertical, a flip about the bike's sideways
// axis through the rider's middle. Where the bike is going doesn't change; only the picture turns.
const qMove = new THREE.Quaternion(), midTmp = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(0, 0, 1), MID = 0.9;
function showMove(root: THREE.Object3D, s: LabState): void {
  if (!s.move) return;
  const k = Math.min(1, s.move.t / MOVE_INFO[s.move.id].seconds());
  const a = 2 * Math.PI * k * k * (3 - 2 * k); // wind up, whip round, settle
  if (s.move.id === 'spin') {
    root.quaternion.premultiply(qMove.setFromAxisAngle(UP, a * s.move.dir));
    return;
  }
  root.quaternion.multiply(qMove.setFromAxisAngle(SIDE, a)); // nose up and over backward
  midTmp.set(0, MID, 0).applyQuaternion(root.quaternion);
  root.position.set(s.pos.x, s.pos.y + MID, s.pos.z).sub(midTmp);
}



export async function createRide(canvas: HTMLCanvasElement, o: RideOptions): Promise<Ride> {
  const { sound, hooks = {} } = o;
  const look = createLook(canvas);
  const course = buildPlace(o.place);
  const scenery = createScenery(look, course); // before the physics: its pines and boulders are solid
  const phys = await createPhysics(course.world);
  mergeStatic(course.world);
  look.scene.add(course.world, ...course.decor);

  let rig = createRider(o.bike);
  look.scene.add(rig.root);
  const startAt = course.stations[o.start] ?? course.stations[course.home];
  const s = createLabState(o.bike, startAt.pos, startAt.yaw);
  s.autoLand = o.autoLand ?? true;
  const timeScale = o.timeScale ?? 1;

  const pad = createPad(() => window.innerWidth);
  bindPad(canvas, pad);
  const cam = createLabCam(look.camera, phys);
  const fx = createFx(look.scene);
  const hud = createHud(document.getElementById('hud')!, () => pad.again(), !!o.debug);
  const governor = createResolutionGovernor(look.renderer, Math.min(window.devicePixelRatio || 1, MAX_RATIO));

  // overlays: speed lines, the speed ring, the last-jump readout, the controls
  const root = o.overlay;
  root.insertAdjacentHTML('beforeend', `<div class="speedlines"></div><div class="wobble-edge"></div><div class="lab-read"><div class="jump"></div><div class="dbg"></div></div>`);
  const lines = root.querySelector<HTMLElement>('.speedlines')!;
  const wobbleEdge = root.querySelector<HTMLElement>('.wobble-edge')!;
  const speedRing = createSpeedRing(root);
  const jumpEl = root.querySelector<HTMLElement>('.jump')!;
  const dbgEl = root.querySelector<HTMLElement>('.dbg')!;
  const controls = createControls(root);
  guardTouches(canvas, pad, controls);
  let paused = false, tumble: Tumble | null = null;
  const prev = new THREE.Vector2(s.pos.x, s.pos.z), cur = new THREE.Vector2(); // for gate crossings
  const clearTumble = () => {
    if (!tumble) return;
    removeTumble(phys, tumble);
    tumble = null;
    rig.reattach();
  };
  const teleport = (name: string) => {
    const st = course.stations[name];
    if (!st) return;
    clearTumble();
    rig.resetHits();
    placeBike(s, st.pos, st.yaw);
    if (st.speed) s.speed = st.speed;
    prev.set(s.pos.x, s.pos.z); // a jump across the map isn't riding through gates
    cam.snap();
  };

  // a soft shadow straight below the rider in the air, so you can see where you'll land
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 28),
    new THREE.MeshBasicMaterial({ color: 0x1b1f24, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  look.scene.add(blob);
  const Z = new THREE.Vector3(0, 0, 1);

  function readIntent(): LabIntent {
    const intent = pad.read();
    const L = pad.thumbs().left;
    if (L) Object.assign(intent, shapeStick(L));
    if (controls.braking()) intent.throttle = -1; // keeps the stick's steering, so brake + steer skids round
    const inside = (a: Zone) => inZone(a, s.pos.x, s.pos.z);
    const coast = T.trackPedal < 0.5 && course.coast.some(inside);
    const climb = course.climb.area.some((a) => inZoneHeading(a, s.pos.x, s.pos.z, s.yaw)), loose = course.climb.loose.some(inside), rough = course.rough.some(inside);
    const full: LabIntent = { ...intent, crouch: pad.crouching(performance.now()), coast, climb, loose, rough };
    hooks.intent?.(full, s);
    return full;
  }

  const vel = new THREE.Vector3();
  let cues = { braking: 0, rough: false }; // for the rig: braking and rough ground move the suspension
  function step(): RideEvents {
    const intent = readIntent();
    cues = { braking: Math.max(0, -intent.throttle), rough: !!intent.rough };
    if (intent.again) rig.resetHits();
    if (s.pos.y < -20) intent.again = true;
    const ev: RideEvents = stepLab(s, intent, STEP, phys, course.lines);
    if (s.crash && !tumble) {
      forward(s, vel).multiplyScalar(s.speed);
      vel.y = Math.max(0, s.vy);
      tumble = spawnTumble(phys, s.pos, vel, s.crash.outcome === 'big' ? 9 : 6);
      ev.tumbleStart = true;
    }
    if (tumble && !s.crash) {
      removeTumble(phys, tumble);
      tumble = null;
      ev.tumbleEnd = true;
    }
    if (tumble) {
      phys.world.step();
      const b = tumble.bike.translation();
      const below = castDown(phys, b.x, b.y + 1, b.z, 40);
      if (below) s.pos.set(b.x, below.height, b.z);
    }
    return ev;
  }

  let names: string[] = [], scrapeCooldown = 0, gateStreak = 0, gateClock = 0, spinClock = 0, spinTold = -10, offTold = -10;
  let climbing: { t: number } | null = null; // riding the climb, from its start line, for the result at the top
  let pumpGlow = 0; // seconds the Jump button stays green after a pump stroke
  function react(ev: RideEvents): void {
    if (ev.pumping) {
      pumpGlow = 0.25;
      rig.pump();
    }
    // a trick off any line scores nothing: not named in the combo, and now and then a word on where points come from
    if ((ev.move || ev.trick) && ev.off && s.clock - offTold > 10) {
      offTold = s.clock;
      hud.callout({ text: 'Just for fun!', sub: 'tricks score off the jumps and on the plank', tone: 'meh' });
    }
    if (ev.move) {
      if (!ev.off) names.push(MOVE_INFO[ev.move].name);
      hud.trick(names, s.combo);
      if (!ev.off) sound.trick(s.combo.count);
    }
    if (ev.popped) sound.pop();
    if (ev.perfect) {
      hud.callout({ text: 'Perfect pop!', tone: 'good' });
      sound.trick(6);
    }
    if (ev.trick) {
      if (!ev.off && (ev.trick !== 'manual' || !names.includes(TRICK_INFO.manual.name))) names.push(TRICK_INFO[ev.trick].name);
      hud.trick(names, s.combo);
      if (!ev.off) sound.trick(s.combo.count);
    }
    if (ev.landed) {
      const strength = Math.min(1.5, 0.15 + (ev.impact ?? 0) / 6);
      const big = (ev.airTime ?? 0) > 0.45;
      if (ev.landed === 'clean' || ev.landed === 'bobble') {
        if ((ev.airTime ?? 0) > 0.2) {
          rig.land(strength, ev.used ?? 0);
          fx.puff(s.pos, s.surface, strength);
          sound.land(strength, s.surface);
          if (ev.bottomed) sound.bottom();
        }
        if (ev.landed === 'bobble') hud.callout(calloutFor('bobble'));
        else if (big && (ev.boost ?? 0) > 0.4) hud.callout({ text: 'Sweet!', sub: `+${mph(ev.boost!)} mph`, tone: 'good' });
        else if (big && ev.bottomed && Math.abs(ev.slope ?? 0) < 0.1) hud.callout({ text: 'Bottomed out!', sub: 'land on the slope to save your speed', tone: 'meh' });
        else if (big && s.combo.count > 0) hud.callout(calloutFor('clean'));
      } else {
        fx.burst(s.pos, s.surface);
        sound.crash(ev.landed === 'big');
        // into a rock or log: say how to get past it next time
        hud.callout(ev.wobbleOut ? { text: 'Speed wobble!', sub: 'brake before it gets scary', tone: 'bad' } : ev.hitRock ? { ...calloutFor(ev.landed), sub: 'brake for the rocks · tap Jump for logs' } : calloutFor(ev.landed));
        names = [];
      }
      if (s.lastJump && (ev.airTime ?? 0) > 0.25) {
        const j = s.lastJump;
        jumpEl.textContent = `air ${j.air.toFixed(2)} s · ${j.height.toFixed(1)} m up · ${j.dist.toFixed(1)} m`;
      }
    }
    // the climb (a try-out)
    if (ev.dab) {
      sound.bump();
      const why = {
        ledge: { text: 'Bonk! Foot down', sub: 'tap Jump to hop up ledges' },
        rock: { text: 'Bonk! Foot down', sub: 'steer round the rocks' },
        loose: { text: 'Foot down', sub: 'gravel needs a little push on the stick' },
        stall: { text: 'Foot down', sub: 'carry more speed into the steep bits' },
        burnt: { text: 'Burnt! Catch your breath', sub: undefined },
      }[ev.dab];
      hud.callout({ ...why, tone: 'meh' });
    }
    // the enduro rolling over a rock: a thump and a little dust, no stop
    if (ev.plow) {
      sound.bump();
      fx.puff(s.pos, 'dirt', 0.3);
    }
    // energy
    if (ev.burnt === 'flat') hud.callout({ text: 'Burnt! Ease off', tone: 'meh' });
    if (ev.energyHint) hud.callout({ text: 'Pushing hard uses energy', tone: 'meh' });
    // a 360 or backflip that ran out of air
    if (ev.short) hud.callout({ text: `Not enough air for a ${MOVE_INFO[ev.short].name}!`, sub: ev.shortPopped ? 'Try a bigger jump' : 'pop it', tone: 'meh' });
    if (ev.spinout) {
      spinClock -= STEP;
      if (spinClock <= 0) {
        spinClock = 0.12;
        fx.puff(s.pos, 'dirt', 0.35);
        sound.scrape();
      }
      if (s.clock - spinTold > 4) {
        spinTold = s.clock;
        hud.callout({ text: 'Easy!', sub: 'the back wheel spins on gravel if you push too hard', tone: 'meh' });
      }
    }
    if (ev.bump) {
      sound.bump();
      rig.bump();
      hud.callout(calloutFor('bump'));
    }
    if (ev.scrape && !scrapeCooldown) {
      sound.scrape();
      scrapeCooldown = 0.15;
    }
    if (ev.banked) {
      hud.bank(ev.banked, s.score);
      sound.bank();
      names = [];
    }
    if (ev.tumbleStart && tumble) rig.detach(tumble, look.scene);
    if (ev.tumbleEnd) rig.reattach();
    hooks.step?.(ev, s);
  }

  let last = performance.now(), acc = 0, fpsTime = 0, fpsFrames = 0;
  function frame(now: number): void {
    const real = Math.min(0.1, (now - last) / 1000);
    const dt = real * timeScale;
    last = now;
    if (!paused) {
      scrapeCooldown = Math.max(0, scrapeCooldown - dt);
      acc = Math.min(acc + dt, MAX_STEPS * STEP);
      while (acc >= STEP) {
        react(step());
        acc -= STEP;
      }
      // slalom gates chime, climbing the scale while you keep the run going
      cur.set(s.pos.x, s.pos.z);
      gateClock += dt;
      course.gates.forEach((g, i) => {
        if (!segmentsCross(prev, cur, g.a, g.b)) return;
        gateStreak = gateClock < 4 ? gateStreak + 1 : 1;
        gateClock = 0;
        sound.trick(Math.min(8, gateStreak));
        hooks.gate?.(i);
      });
      // the climb: start the count at the bottom line, say how it went at the top, and cheer a hopped ledge
      // the start line reads forward riding down, so going up crosses it from the left of its a-to-b
      const { a, b } = course.climb.start, upward = (b.x - a.x) * (prev.y - a.y) - (b.y - a.y) * (prev.x - a.x) > 0;
      if (segmentsCross(prev, cur, a, b) && upward) {
        climbing = { t: 0 };
        s.dabs = 0;
      }
      if (climbing) climbing.t += dt;
      if (climbing && segmentsCross(prev, cur, course.climb.top.a, course.climb.top.b)) {
        const time = `${climbing.t.toFixed(1)} s`;
        if (s.dabs === 0) {
          hud.callout({ text: 'Cleaned it!', sub: `no feet down · ${time}`, tone: 'good' });
          sound.trick(8);
        } else hud.callout({ text: 'Made it!', sub: `${s.dabs} ${s.dabs === 1 ? 'foot' : 'feet'} down · ${time}`, tone: 'meh' });
        climbing = null;
      }
      for (const l of course.climb.ledges) {
        // crossed its edge going the way it's ridden (not back over it), and up on top of it
        const g = ledgeGate(l), ridden = (cur.x - prev.x) * Math.cos(l.yaw) - (cur.y - prev.y) * Math.sin(l.yaw) > 0;
        if (ridden && segmentsCross(prev, cur, g.a, g.b) && s.pos.y > l.pos.y - 0.1) hud.callout({ text: 'Up and over!', tone: 'good' });
      }
      prev.copy(cur);
      const plant = course.bumpers.update(dt, s.pos);
      if (plant && !s.crash) {
        fx.burst(plant, 'grass');
        sound.bump();
        s.speed *= 0.92;
      }
    } else prev.set(s.pos.x, s.pos.z);
    hooks.frame?.(paused ? 0 : dt, now);
    scenery.update(paused ? 0 : dt, s.pos);
    if (tumble) rig.followTumble(tumble);
    else {
      rig.root.rotation.set(0, rig.root.rotation.y, 0); // clear last frame's spin or flip
      rig.update(s, dt, pad.crouching(now), cues);
      showMove(rig.root, s);
    }
    cam.update(s, paused ? 0 : dt);
    followSun(look.sun, s.pos);
    s.bike.cruise = T.cruise; // dust kicks up above cruise
    fx.update(paused ? 0 : dt, s);
    sound.update({ ...s, speed: paused ? 0 : Math.min(10, (s.speed * 10) / 14) });
    hud.update(s, pad.thumbs());
    const th = pad.thumbs();
    pumpGlow = Math.max(0, pumpGlow - dt);
    // a ledge or log just ahead: warn early enough to hop it, further out at speed
    const near = s.grounded ? course.climb.ledges.find((l) => {
      return ledgeAhead(l, s.pos.x, s.pos.z, s.yaw) < Math.max(4.5, s.speed * 0.9) && Math.abs(l.pos.y - s.pos.y) < 1;
    }) : undefined;
    const ledge = near ? (near.log ? 'log' : 'ledge') : false;
    const loose = s.grounded && s.slope > 0.03 && course.climb.loose.some((a) => inZone(a, s.pos.x, s.pos.z));
    controls.update(th.left, th.right, now, { inAir: !s.grounded && !s.crash && !tumble, pumping: pumpGlow > 0, downhill: s.grounded && s.slope < -0.05, ledge, loose, energy: s.energy, burnt: s.burnt });

    // speed lines past sprint; shadow under the rider in the air
    const lineShare = Math.max(0, Math.min(1, (s.speed - T.sprint) / Math.max(1, T.maxSpeed - T.sprint)));
    lines.style.opacity = String(T.speedLines * lineShare * 0.75 * (s.crash ? 0 : 1));
    // close to a speed-wobble wipeout: the screen edges pulse red
    const redEdge = s.crash ? 0 : Math.max(0, (s.wobble / Math.max(0.01, T.wobbleLimit) - 0.5) * 2);
    wobbleEdge.style.opacity = (redEdge * (0.6 + 0.4 * Math.sin(now / 60))).toFixed(2);
    if (lineShare > 0) lines.style.transform = `rotate(${(Math.random() * 6).toFixed(2)}deg)`;
    speedRing.update(s.speed, T);
    const g = !s.grounded && !tumble ? castDown(phys, s.pos.x, s.pos.y + 0.3, s.pos.z, 60) : null;
    if (g) {
      const h = s.pos.y - g.height;
      blob.position.set(s.pos.x, g.height + 0.03, s.pos.z);
      blob.quaternion.setFromUnitVectors(Z, g.normal);
      blob.scale.setScalar(1 + h * 0.06);
      (blob.material as THREE.MeshBasicMaterial).opacity = 0.34 * Math.min(1, h / 0.6);
    } else (blob.material as THREE.MeshBasicMaterial).opacity = 0;

    look.renderer.render(look.scene, look.camera);
    governor(real);
    fpsTime += real;
    fpsFrames++;
    if (fpsTime >= 0.5) {
      const info = look.renderer.info.render;
      hud.debug({ fps: fpsFrames / fpsTime, calls: info.calls, triangles: info.triangles, ratio: look.renderer.getPixelRatio() });
      if (o.debug) dbgEl.textContent = `skid ${s.skid.toFixed(2)} · assist ${s.assisting.toFixed(2)} · ${s.surface}`;
      fpsTime = fpsFrames = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const setBike = (spec: BikeSpec) => {
    clearTumble();
    if (s.crash) {
      // swapped mid-crash: get up on the new bike where you fell, as tired as you were
      const { energy, burnt } = s;
      placeBike(s, s.pos.clone(), s.yaw);
      Object.assign(s, { energy, burnt });
    }
    resetRide(s);
    look.scene.remove(rig.root);
    rig.root.traverse((m) => {
      if (m instanceof THREE.Mesh) m.geometry.dispose(); // not the materials: mat() shares them
    });
    rig = createRider(spec);
    look.scene.add(rig.root);
    s.bike = { ...spec };
  };

  return { s, course, phys, look, pad, hud, controls, teleport, setBike, setPaused: (p) => (paused = p), paused: () => paused };
}
