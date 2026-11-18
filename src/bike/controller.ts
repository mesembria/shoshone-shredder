import * as THREE from 'three';
import type { BikeSpec } from '../rules/bikes';
import { nextSpeed, turnRate, isSkidding, skidTurnRate, SKID } from '../rules/ride';
import { hopSpeed, HOP } from '../rules/hop';
import type { SwipeDir } from '../rules/gestures';
import { trickForSwipe, TRICK_INFO, addToCombo, comboTotal, EMPTY_COMBO, type Combo, type TrickId } from '../rules/tricks';
import { classifyLanding, wallResponse, penaltiesFor, wobbleSteer, pedalPower, CRASH, type Outcome } from '../rules/crash';
import { castDown, sweepBody, bodyFits, type Physics, type Surface } from '../world/physics';

// steer: -1 left .. 1 right. throttle: -1 brake .. 1 push. hop: seconds held when the thumb lifted, or null.
export interface Intent { steer: number; throttle: number; hop: number | null; swipe: SwipeDir | null; again: boolean }
export interface StepEvents { trick?: TrickId; landed?: Outcome; bump?: boolean; scrape?: boolean; banked?: number; popped?: boolean }

export interface BikeState {
  bike: BikeSpec;
  pos: THREE.Vector3; // point on the ground midway between the wheels
  yaw: number; // 0 faces +x; turning left raises it
  pitch: number; // nose up is positive, radians
  speed: number;
  vy: number;
  grounded: boolean;
  groundY: number;
  surface: Surface;
  peakY: number;
  sinceLip: number | null;
  popped: boolean;
  trick: { id: TrickId; t: number } | null;
  manual: number;
  groundedFor: number;
  combo: Combo;
  score: number;
  crash: { outcome: Outcome; t: number } | null;
  stars: number;
  winded: number;
  skidding: boolean;
  autoLand: boolean;
  trail: { pos: THREE.Vector3; yaw: number }[];
  trailClock: number;
  respawn: { pos: THREE.Vector3; yaw: number };
}

export const G = 16;
// PROBE_UP: wheel probes start this far above the bike, so they find steps up to STEP_UP and never the
// underside of a slide or a deck overhead.
const WHEELBASE = 1.1, PROBE_UP = 0.6, STEP_UP = 0.45, PROBE_DIST = 4, LEDGE = 0.08, BANK_AFTER = 1;
const fwdTmp = new THREE.Vector3();
const moveTmp = new THREE.Vector3(), nTmp = new THREE.Vector3();

export function createBikeState(bike: BikeSpec, pos: THREE.Vector3, yaw: number): BikeState {
  return {
    bike, pos: pos.clone(), yaw, pitch: 0, speed: 0, vy: 0, grounded: true, groundY: pos.y, surface: 'ground',
    peakY: pos.y, sinceLip: null, popped: false, trick: null, manual: 0, groundedFor: 0, combo: EMPTY_COMBO,
    score: 0, crash: null, stars: 0, winded: 0, skidding: false, autoLand: true, trail: [], trailClock: 0,
    respawn: { pos: pos.clone(), yaw },
  };
}

export function forward(s: BikeState, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
}

function startCrash(s: BikeState, outcome: Outcome): void {
  s.crash = { outcome, t: 0 };
  s.combo = EMPTY_COMBO;
  s.trick = null;
  s.manual = 0;
  const p = penaltiesFor(outcome);
  s.stars = Math.max(s.stars, p.stars);
  s.winded = Math.max(s.winded, p.winded);
}

// Again puts you back where you started the last run-up; getting up on your own keeps you where you fell.
function getUp(s: BikeState, toRespawn: boolean): void {
  if (toRespawn) {
    s.pos.copy(s.respawn.pos);
    s.yaw = s.respawn.yaw;
  }
  Object.assign(s, { crash: null, speed: 0, vy: 0, pitch: 0, grounded: true, sinceLip: null, popped: false, trick: null, manual: 0, groundedFor: 0, skidding: false });
}

function takeOff(s: BikeState, vy: number): void {
  s.grounded = false;
  s.vy = vy;
  s.peakY = s.pos.y;
  s.popped = false;
  s.groundedFor = 0;
  const past = s.trail[0] ?? { pos: s.pos, yaw: s.yaw };
  s.respawn = { pos: past.pos.clone(), yaw: past.yaw };
}

export function stepBike(s: BikeState, input: Intent, dt: number, time: number, phys: Physics): StepEvents {
  const ev: StepEvents = {};
  s.stars = Math.max(0, s.stars - dt);
  s.winded = Math.max(0, s.winded - dt);
  if (s.crash) {
    s.crash.t += dt;
    if (input.again) getUp(s, true);
    else if (s.crash.t >= CRASH.getUpSeconds) getUp(s, false);
    return ev;
  }
  if (input.again) {
    getUp(s, true);
    return ev;
  }
  const steer = wobbleSteer(input.steer, time, s.stars);
  s.skidding = s.grounded && isSkidding(s.speed, input.throttle, steer);
  const loose = s.surface === 'grass' || s.surface === 'tallgrass' || s.surface === 'dirt';
  const rate = s.skidding ? skidTurnRate(s.speed, s.bike, loose) : turnRate(s.speed);
  const yaw = s.yaw - steer * rate * dt * (s.grounded ? 1 : 0.35);
  // the bike can't swing its body into a wall (unless it was already stuck, so it can always turn out)
  if (yaw !== s.yaw && (bodyFits(phys, s.pos, yaw) || !bodyFits(phys, s.pos, s.yaw))) s.yaw = yaw;
  return s.grounded ? groundStep(s, input, dt, phys, ev) : airStep(s, input, dt, phys, ev);
}

// Move the body forward, stopping at whatever it touches. A fast head-on hit crashes; a slower one bonks;
// a glancing one turns the bike along the wall and slides on. Returns true when the rider crashed.
function moveBody(s: BikeState, dt: number, phys: Physics, ev: StepEvents): boolean {
  let move = forward(s, moveTmp).multiplyScalar(s.speed * dt);
  for (let i = 0; i < 3; i++) {
    const hit = sweepBody(phys, s.pos, s.yaw, move);
    if (!hit) {
      s.pos.add(move);
      return false;
    }
    s.pos.addScaledVector(move, hit.toi);
    if (i > 0) return false; // a corner: stop for this step
    const n = nTmp.set(hit.normal.x, 0, hit.normal.z);
    const fwd = forward(s, fwdTmp);
    if (n.lengthSq() < 1e-4) n.copy(fwd).negate();
    n.normalize();
    const r = wallResponse(s.speed, -fwd.dot(n));
    if (r.outcome === 'wipeout' || r.outcome === 'big') {
      startCrash(s, r.outcome);
      ev.landed = r.outcome;
      return true;
    }
    if (r.outcome === 'bump') ev.bump = true;
    else if (s.speed > 1) ev.scrape = true;
    s.speed = r.speed;
    if (r.slide) {
      const t = fwd.addScaledVector(n, -fwd.dot(n)).normalize();
      const along = Math.atan2(-t.z, t.x);
      if (bodyFits(phys, s.pos, along)) s.yaw = along;
    }
    move = forward(s, moveTmp).multiplyScalar(s.speed * dt * (1 - hit.toi));
  }
  return false;
}

function groundStep(s: BikeState, input: Intent, dt: number, phys: Physics, ev: StepEvents): StepEvents {
  const loose = s.surface === 'grass' || s.surface === 'tallgrass' || s.surface === 'dirt';
  s.speed = s.skidding ? Math.max(0, s.speed - SKID.decel * dt) : nextSpeed(s.speed, input.throttle, dt, s.bike, loose, pedalPower(s.winded));
  if (input.swipe && trickForSwipe(input.swipe, true) === 'manual' && s.manual <= 0) {
    s.manual = 3;
    s.combo = addToCombo(s.combo, 0);
    ev.trick = 'manual';
  }
  if (s.manual > 0) {
    s.manual = Math.max(0, s.manual - dt);
    s.combo = { ...s.combo, points: s.combo.points + TRICK_INFO.manual.points * dt };
  }
  if (moveBody(s, dt, phys, ev)) return ev;
  const fwd = forward(s, fwdTmp);
  const half = WHEELBASE / 2;
  const front = castDown(phys, s.pos.x + fwd.x * half, s.pos.y + PROBE_UP, s.pos.z + fwd.z * half, PROBE_DIST);
  const rear = castDown(phys, s.pos.x - fwd.x * half, s.pos.y + PROBE_UP, s.pos.z - fwd.z * half, PROBE_DIST);
  // A wheel is off when the ground under it falls away faster than a slope could. The bike rides on the
  // other wheel along its current pitch, so it leaves a lip only when the rear wheel does.
  const tilt = Math.tan(s.pitch) * half;
  const drop = LEDGE + s.speed * dt * 0.3;
  // a probe that finds something higher than a step is looking at a wall, which the body sweep handles
  const frontOff = !front || front.height < s.pos.y + tilt - drop || front.height > s.pos.y + tilt + STEP_UP;
  const rearOff = !rear || rear.height < s.pos.y - tilt - drop || rear.height > s.pos.y - tilt + STEP_UP;
  if (frontOff && rearOff) {
    takeOff(s, Math.max(0, s.vy));
    s.sinceLip = 0;
    return ev;
  }
  const h = frontOff ? rear!.height + tilt : rearOff ? front!.height - tilt : (front!.height + rear!.height) / 2;
  s.vy = Math.min((h - s.pos.y) / dt, s.speed * 0.8);
  s.pos.y = h;
  s.groundY = h;
  if (!frontOff && !rearOff) s.pitch = Math.atan2(front!.height - rear!.height, WHEELBASE);
  s.surface = (frontOff ? rear : front)!.surface;
  if (input.hop !== null) {
    const v = hopSpeed(input.hop, null);
    takeOff(s, Math.max(0, s.vy) + (s.vy > 0.5 ? v * HOP.lipShare : v));
    s.sinceLip = null;
    s.popped = true;
    s.combo = addToCombo(s.combo, TRICK_INFO.bunnyhop.points);
    ev.trick = 'bunnyhop';
    ev.popped = true;
    return ev;
  }
  s.groundedFor += dt;
  if (s.manual <= 0 && s.groundedFor >= BANK_AFTER && s.combo.count > 0) {
    ev.banked = comboTotal(s.combo);
    s.score += ev.banked;
    s.combo = EMPTY_COMBO;
  }
  s.trailClock += dt;
  if (s.trailClock >= 0.25) {
    s.trailClock = 0;
    s.trail.push({ pos: s.pos.clone(), yaw: s.yaw });
    if (s.trail.length > 6) s.trail.shift();
  }
  return ev;
}

function timeToFall(height: number, vy: number): number {
  const disc = vy * vy + 2 * G * height;
  return disc < 0 ? Infinity : (vy + Math.sqrt(disc)) / G;
}

function airStep(s: BikeState, input: Intent, dt: number, phys: Physics, ev: StepEvents): StepEvents {
  if (s.sinceLip !== null) s.sinceLip += dt;
  if (input.hop !== null && !s.popped && s.sinceLip !== null && s.sinceLip <= HOP.perfectWindow) {
    s.vy += hopSpeed(input.hop, s.sinceLip) * HOP.lipShare;
    s.popped = true;
    s.combo = addToCombo(s.combo, TRICK_INFO.bunnyhop.points);
    ev.trick = 'bunnyhop';
    ev.popped = true;
  }
  if (input.swipe && !s.trick) {
    const id = trickForSwipe(input.swipe, false);
    if (id) s.trick = { id, t: 0 };
  }
  if (s.trick) {
    s.trick.t += dt * s.bike.spin;
    if (s.trick.t >= TRICK_INFO[s.trick.id].seconds) {
      s.combo = addToCombo(s.combo, TRICK_INFO[s.trick.id].points);
      ev.trick = s.trick.id;
      s.trick = null;
    }
  }
  s.vy -= G * dt;
  if (moveBody(s, dt, phys, ev)) return ev;
  const fwd = forward(s, fwdTmp);
  s.pos.y += s.vy * dt;
  s.peakY = Math.max(s.peakY, s.pos.y);
  const below = castDown(phys, s.pos.x, s.pos.y + PROBE_UP, s.pos.z, PROBE_DIST + 40);
  const groundY = below ? below.height : -1000;
  const gp = below ? Math.atan2(-(below.normal.x * fwd.x + below.normal.z * fwd.z), below.normal.y) : 0;
  s.groundY = groundY;
  // In the air the nose follows the arc a little; the left stick leans it; auto-land levels it just before touchdown.
  const assist = s.autoLand && timeToFall(s.pos.y - groundY, s.vy) < 0.35;
  const target = assist ? gp : Math.atan2(s.vy, Math.max(1, s.speed)) * 0.6;
  s.pitch += -input.throttle * 2.5 * dt + (target - s.pitch) * (1 - Math.exp(-dt * (assist ? 6 : 1.5)));
  if (below && s.pos.y <= groundY) {
    const outcome = classifyLanding({
      angleErrorDeg: (Math.abs(s.pitch - gp) * 180) / Math.PI,
      fallHeight: s.peakY - groundY,
      impactSpeed: -s.vy,
      trickUnfinished: s.trick !== null,
      autoLand: s.autoLand,
    });
    s.pos.y = groundY;
    s.grounded = true;
    s.vy = 0;
    s.pitch = gp;
    s.sinceLip = null;
    s.surface = below.surface;
    s.trick = null;
    ev.landed = outcome;
    if (outcome === 'bobble') s.speed *= CRASH.bobbleSpeedKeep;
    if (outcome === 'wipeout' || outcome === 'big') startCrash(s, outcome);
  }
  return ev;
}
