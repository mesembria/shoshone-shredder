// Wires the pieces together and runs the frame loop.
import { BIKES, type BikeId } from './rules/bikes';
import { TRICK_INFO } from './rules/tricks';
import { createLook, createResolutionGovernor, followSun, MAX_RATIO } from './look/toyLook';
import { buildWorld, mergeStatic, START, START_PARK } from './world/build';
import { createPhysics } from './world/physics';
import { createSession, type SessionEvent } from './session';
import { createRider } from './bike/rider';
import { createPad, bindPad } from './input/controls';
import { createChaseCam } from './view/camera';
import { createHud, calloutFor } from './view/hud';
import { createFx } from './view/fx';
import type { Sound } from './view/sound';

// timeScale below 1 is slow motion, for tuning landings and for browser tests
export interface GameOptions { debug: boolean; autoLand: boolean; start: 'home' | 'park'; timeScale: number }

export async function startGame(canvas: HTMLCanvasElement, hudRoot: HTMLElement, bikeId: BikeId, sound: Sound, opts: GameOptions): Promise<void> {
  const look = createLook(canvas);
  const world = buildWorld();
  const phys = await createPhysics(world); // colliders first: they read the tags on each mesh
  mergeStatic(world); // then merge meshes by color for fewer draw calls
  look.scene.add(world);

  const bike = BIKES[bikeId];
  const rig = createRider(bike);
  look.scene.add(rig.root);
  const session = createSession(phys, bike, opts.start === 'park' ? START_PARK : START);
  const s = session.state;
  s.autoLand = opts.autoLand;
  if (opts.debug) (window as unknown as { __session: typeof session }).__session = session; // for browser tests

  const pad = createPad(() => window.innerWidth);
  bindPad(canvas, pad);
  const cam = createChaseCam(look.camera, phys, bike.topSpeed);
  const fx = createFx(look.scene);
  const hud = createHud(hudRoot, () => pad.again(), opts.debug);
  const governor = createResolutionGovernor(look.renderer, Math.min(window.devicePixelRatio || 1, MAX_RATIO));
  let names: string[] = [];
  let scrapeCooldown = 0; // sliding along a wall would otherwise hiss every step

  function react(ev: SessionEvent): void {
    if (ev.popped) sound.pop();
    if (ev.trick) {
      if (ev.trick !== 'manual' || !names.includes(TRICK_INFO.manual.name)) names.push(TRICK_INFO[ev.trick].name);
      hud.trick(names, s.combo);
      sound.trick(s.combo.count);
    }
    if (ev.landed) {
      const fall = Math.max(0, s.peakY - s.pos.y);
      const strength = Math.min(1.5, 0.2 + fall / 2);
      if (ev.landed === 'clean' || ev.landed === 'bobble') {
        rig.land(strength);
        fx.puff(s.pos, s.surface, strength);
        sound.land(strength, s.surface);
        if (ev.landed === 'bobble' || s.combo.count > 0 || fall > 1) hud.callout(calloutFor(ev.landed));
      } else {
        fx.burst(s.pos, s.surface);
        sound.crash(ev.landed === 'big');
        hud.callout(calloutFor(ev.landed));
        names = [];
      }
    }
    if (ev.bump) {
      sound.bump();
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
    if (ev.tumbleStart && session.tumble) rig.detach(session.tumble, look.scene);
    if (ev.tumbleEnd) rig.reattach();
  }

  let last = performance.now(), fpsTime = 0, fpsFrames = 0;
  function frame(now: number): void {
    const real = Math.min(0.1, (now - last) / 1000);
    const dt = real * opts.timeScale;
    last = now;
    scrapeCooldown = Math.max(0, scrapeCooldown - dt);
    for (const ev of session.advance(dt, () => pad.read())) react(ev);
    if (session.tumble) rig.followTumble(session.tumble);
    else rig.update(s, dt, pad.crouching(now));
    cam.update(s, dt);
    followSun(look.sun, s.pos);
    fx.update(dt, s);
    sound.update(s);
    hud.update(s, pad.thumbs());
    look.renderer.render(look.scene, look.camera);
    governor(real);
    fpsTime += real;
    fpsFrames++;
    if (fpsTime >= 0.5) {
      const info = look.renderer.info.render;
      hud.debug({ fps: fpsFrames / fpsTime, calls: info.calls, triangles: info.triangles, ratio: look.renderer.getPixelRatio() });
      fpsTime = fpsFrames = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
