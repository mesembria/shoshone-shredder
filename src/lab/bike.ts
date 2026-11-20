// The lab bike: the prototype's arcade bike with the feel changes we're trying out.
// - Up/down on the stick sets a speed the bike holds (slow roll, cruise, sprint); brakes only when you pull back.
// - Hills and landing slopes change speed; pedaling only gets you to sprint, gravity gets you past it.
// - Turns are as tight as grip allows at speed and very tight when slow; pulling back while steering slides the
//   rear and tightens the turn smoothly, with no on/off point; full steer can slow you down by itself.
// - Highlighted lines (takeoffs, skinnies) pull you onto them when you're roughly aimed at them.
// - Walls: glancing hits slide you along and ease your heading round; only head-on hits stop you.
// - Jumps: the ramp launches you, you leave the ground wherever it falls away faster than you can follow,
//   gravity floats near the top, an early pop is remembered until the lip, and landing slopes give speed back.
import * as THREE from 'three';
import { createBikeState, forward, type BikeState, type Intent, type StepEvents } from '../bike/controller';
import { kitOf, type BikeSpec } from '../rules/bikes';
import { trickForSwipe, TRICK_INFO, addToCombo, comboTotal, EMPTY_COMBO } from '../rules/tricks';
import type { SwipeDir } from '../rules/gestures';
import { landingCapacity, bottomTier } from '../rules/suspension';
import { classifyLanding, penaltiesFor, wobbleSteer, pedalPower, CRASH, type Outcome } from '../rules/crash';
import { BODY, castDown, type Physics } from '../world/physics';
import { sweepTilted, fitsTilted, pressedTilted } from './body';
import { T } from './tune';
import { stepEnergy, gearLimit, type Effort } from './energy';
import { wobbleOver, steerGain, bumpKick, stepWobble } from './wobble';
import type { Line } from './course';

// coast: no pedaling here (the pump track). climb: the climb's rules apply (try-out); loose: gravel underfoot
export interface LabIntent extends Intent { crouch: boolean; coast?: boolean; climb?: boolean; loose?: boolean; rough?: boolean }
export type Move = 'spin' | 'flip';
// off: a trick done off any line, so it scored nothing (points come from lines over features)
export interface LabEvents extends StepEvents { off?: true; perfect?: boolean; impact?: number; boost?: number; airTime?: number; slope?: number; pumping?: boolean; move?: Move; dab?: 'stall' | 'ledge' | 'rock' | 'loose' | 'burnt'; burnt?: 'climb' | 'flat'; energyHint?: true; wobbleOut?: true; plow?: boolean; short?: Move; shortPopped?: boolean; spinout?: boolean; wallStop?: boolean; hitRock?: boolean; used?: number; bottomed?: boolean }

export interface LabState extends BikeState {
  steer: number; // smoothed steer
  slope: number; // ground slope under the middle of the bike, along the heading (uphill positive)
  vyGround: number; // vertical speed while riding the ground, carried into a takeoff
  skid: number; // 0..1, how much the rear wheel is sliding
  pendingPop: { hold: number; at: number } | null; // a pop pressed on a takeoff, waiting for the lip
  clock: number;
  lipAt: number | null; // when the bike last left a lip
  // soaked: launch speed the suspension took. feature: it left from a feature, so its tricks count and it keeps the
  // line going (other air lets the bank clock run)
  air: { t: number; x: number; z: number; y: number; line: Line | null; pull: number; soaked: number; feature: boolean } | null;
  // a combo line is open. Points come from lines over features: a line starts on a feature (a lip launch, or the
  // plank and kickers' ramp surface), lasts through air off a feature or a manual, and banks a second after either
  onLine: boolean;
  lastJump: { air: number; height: number; dist: number } | null;
  lastWall: number;
  assisting: number; // how hard the line assist pulled this step, for the debug readout
  bank: number; // sideways tilt of the ground under the bike, as a slope: positive tips the bike to its left
  pumped: boolean; // this press of the jump button has pumped, so letting go of it isn't a jump
  crouchFor: number; // seconds the jump button has been held in this air
  tableDone: boolean; // this press already did its tabletop (or began on the ground)
  airPts: number; // trick and move points finished in this air
  boost: number; // seconds left of the landing speed burst (T.trickBoost)
  boostPush: number; // m/s the burst adds over its whole length, set by how big the trick was
  boostGain: number; // m/s the burst has added that hasn't drained away yet
  move: { id: Move; t: number; dir: number } | null; // a 360 or a backflip in progress
  dab: number; // seconds left with a foot down (stalled on a climb)
  dabGrace: number; // seconds after getting going again before a slow moment counts as another stall
  dabs: number; // feet down since the count was last reset
  energy: number; // 0..1: pushing hard uses it, coasting and stopping refill it
  burnt: boolean; // ran out: soft legs until the tank is back to T.burntUntil
  burntRest: boolean; // the foot that's down is a burnt rest: it lifts once you've caught your breath
  resting: boolean; // braked to a stop on purpose: foot down, refilling fastest
  told: { energy: boolean }; // one-time hints already shown
  wobble: number; // 0..T.wobbleLimit: the speed wobble building up
  yawRate: number; // last step's steering turn rate, to see the bars swinging
}
// In the air: swipe down for a backflip, left or right for a 360 (up is the no-hander).
export function airMove(swipe: SwipeDir): Move | null {
  return swipe === 'down' ? 'flip' : swipe === 'left' || swipe === 'right' ? 'spin' : null;
}
export const MOVE_INFO: Record<Move, { name: string; points: number; seconds: () => number }> = {
  spin: { name: '360', points: 300, seconds: () => T.spinTime },
  flip: { name: 'Backflip', points: 400, seconds: () => T.flipTime },
};

// DROP: a step down bigger than this is ridden off as a drop, not rolled down like a curb
const WHEELBASE = 1.1, PROBE_UP = 0.6, STEP_UP = 0.45, PROBE_DIST = 4, DROP = 0.15, BANK_AFTER = 1;
const MIN_LAUNCH = 1.5; // m/s of upward speed needed to leave the ground over a crest or lip
const BOOST_BLEED = 0.15; // s: how fast a finished trick burst drains away
const SPRINT_OVER_CRUISE = 2.5; // m/s: the least that pushing the stick up adds over cruise
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const fwdTmp = new THREE.Vector3(), dirTmp = new THREE.Vector3(), nTmp = new THREE.Vector3(), moveTmp = new THREE.Vector3(), flatTmp = new THREE.Vector3(), toTmp = new THREE.Vector3();

export function createLabState(bike: BikeSpec, pos: THREE.Vector3, yaw: number): LabState {
  return Object.assign(createBikeState({ ...bike }, pos, yaw), {
    steer: 0, slope: 0, vyGround: 0, skid: 0, pendingPop: null, clock: 0, lipAt: null, air: null, onLine: false, lastJump: null, lastWall: -1, assisting: 0,
    bank: 0, pumped: false, crouchFor: 0, tableDone: false, airPts: 0, boost: 0, boostPush: 0, boostGain: 0, move: null, dab: 0, dabGrace: 0, dabs: 0,
    energy: 1, burnt: false, burntRest: false, resting: false, told: { energy: false }, wobble: 0, yawRate: 0,
  });
}

export function placeBike(s: LabState, pos: THREE.Vector3, yaw: number): void {
  s.respawn = { pos: pos.clone(), yaw };
  s.trail = [];
  getUp(s, true);
  s.energy = 1; // a warp is a fresh start; getting up after a crash isn't
  s.burnt = false;
}

function startCrash(s: LabState, outcome: Outcome): void {
  s.crash = { outcome, t: 0 };
  s.combo = EMPTY_COMBO;
  s.onLine = false;
  s.trick = null;
  s.move = null;
  s.manual = 0;
  s.pendingPop = null;
  s.air = null;
  const p = penaltiesFor(outcome);
  s.stars = Math.max(s.stars, p.stars);
  s.winded = Math.max(s.winded, p.winded);
}

// A different bike under you: its wobble starts fresh, your legs stay as tired as they were.
export function resetRide(s: LabState): void {
  s.wobble = 0;
  s.yawRate = 0;
}

const phaseOf = (s: LabState) => s.clock * 3.1 + s.pos.x * 0.37 + s.pos.z * 0.21;

function getUp(s: LabState, toRespawn: boolean): void {
  if (toRespawn) {
    s.pos.copy(s.respawn.pos);
    s.yaw = s.respawn.yaw;
  }
  Object.assign(s, {
    crash: null, speed: 0, vy: 0, vyGround: 0, pitch: 0, slope: 0, grounded: true, sinceLip: null, popped: false, trick: null, manual: 0,
    groundedFor: 0, skidding: false, skid: 0, steer: 0, pendingPop: null, air: null, onLine: false, lipAt: null, bank: 0, pumped: false, move: null,
    dab: 0, dabGrace: 0, burntRest: false, resting: false, wobble: 0, yawRate: 0, airPts: 0, boost: 0, boostPush: 0, boostGain: 0,
  });
}

// The bike never stays overlapping anything: a body that overlaps can't move at all (every sweep is blocked at once),
// and turning in place only digs it deeper. Ways in that turned up: getting up where the tumble's loose bodies stopped
// (they're smaller than the riding body and can rest against, or inside, a plant clump), coming down from the air (the
// fall isn't swept, so you can drop onto a clump's open top), and a graze within millimetres that a change of pitch
// tips into an overlap, and a body pressed a few cm into a rock or clump on both sides (it fits by the slim body, but
// every full-size sweep is blocked at once). So after every step on the ground (and on getting up) a bike that overlaps
// anything, or is pressed into an obstacle, stands at the nearest spot round there where it's clear, on open ground,
// still facing the same way.
const standTmp = new THREE.Vector3();
const clear = (phys: Physics, pos: THREE.Vector3, yaw: number, pitch: number) => fitsTilted(phys, pos, yaw, pitch) && !pressedTilted(phys, pos, yaw, pitch);
function standClear(s: LabState, phys: Physics, pitch = 0): void {
  if (clear(phys, s.pos, s.yaw, pitch)) return;
  for (let r = 0.05; r <= 3; r += 0.05) {
    const n = Math.max(8, Math.ceil((2 * Math.PI * r) / 0.15));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, x = s.pos.x + r * Math.cos(a), z = s.pos.z + r * Math.sin(a);
      const g = castDown(phys, x, s.pos.y + 1.5, z, 4);
      if (!g || g.surface === 'rock' || g.surface === 'wall') continue;
      if (clear(phys, standTmp.set(x, g.height, z), s.yaw, pitch)) {
        s.pos.copy(standTmp);
        return;
      }
    }
  }
}

// ---- landing pull: in the air, nudge the bike toward the sweet spot of the landing it's heading for

// Where a jump from this lip comes down, with the lab's three-part gravity. Returns meters past the lip.
function predictLanding(speed: number, vy: number, y0: number, landY: number): number {
  let x = 0, y = y0, v = vy;
  const dt = 1 / 120;
  for (let i = 0; i < 600; i++) {
    v -= (v > T.floatBand ? T.gUp : v > -T.floatBand ? T.gFloat : T.gDown) * dt;
    x += speed * dt;
    y += v * dt;
    if (v < 0 && y <= landY) return x;
  }
  return x;
}

function lineFor(s: LabState, lines: Line[]): Line | null {
  for (const L of lines) {
    if (!L.land) continue;
    const dx = s.pos.x - L.lip.x, dz = s.pos.z - L.lip.z;
    const along = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw);
    const lateral = -dx * Math.sin(L.yaw) - dz * Math.cos(L.yaw);
    if (along > -1 && along < 1.5 && Math.abs(lateral) < L.width / 2 + 0.5 && Math.abs(s.pos.y - L.lip.y) < 1) return L;
  }
  return null;
}

// The share of horizontal speed to keep in the air so the bike lands a little past the top of the landing.
function landingPull(s: LabState, L: Line | null): number {
  if (!L?.land || T.landPull <= 0) return 1;
  const target = L.land.knuckle + L.land.length * 0.4;
  const dx = s.pos.x - L.lip.x, dz = s.pos.z - L.lip.z;
  const done = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw);
  const ahead = predictLanding(s.speed, s.vy, s.pos.y, L.lip.y - L.land.drop * 0.45);
  const want = target - done;
  if (ahead <= 0.5 || want <= 0.5) return 1;
  const ratio = want / ahead;
  if (ratio < 0.4 || ratio > 2.2) return 1; // way short or way long: you're on your own
  return 1 + (ratio - 1) * T.landPull;
}

// ---- line assist: steer gently onto a highlighted line when roughly aimed at it

function lineAssist(s: LabState, lines: Line[], steer: number): number {
  if (T.assist <= 0 || s.speed < 1.5) return 0;
  const maxAngle = (T.assistAngle * Math.PI) / 180;
  let best = 0, bestW = 0;
  for (const L of lines) {
    const dx = s.pos.x - L.lip.x, dz = s.pos.z - L.lip.z;
    const along = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw); // negative before the lip
    if (along < -T.assistReach || along > L.after - 0.3) continue;
    if (L.after === 0 && along > -0.6) continue;
    const lateral = -dx * Math.sin(L.yaw) - dz * Math.cos(L.yaw); // positive: left of the line
    const reach = L.width / 2 + 2;
    if (Math.abs(lateral) > reach) continue;
    if (Math.abs(s.pos.y - L.lip.y) > (along < 0 ? 3 : 0.8)) continue;
    const head = wrap(s.yaw - L.yaw);
    if (Math.abs(head) > maxAngle) continue;
    const w = Math.min(1, (1 - Math.abs(head) / maxAngle) * 2) * Math.min(1, (1 - Math.abs(lateral) / reach) * 2) * Math.min(1, (T.assistReach + along) / 2);
    if (w <= bestW) continue;
    const look = clamp(-along * 0.6, 2.5, 6);
    const err = wrap(L.yaw - Math.atan2(lateral, look) - s.yaw);
    best = clamp(err * 5, -1.6, 1.6) * w;
    bestW = w;
  }
  return best * T.assist * (1 - 0.8 * Math.abs(steer));
}

// ---- stepping

export function stepLab(s: LabState, input: LabIntent, dt: number, phys: Physics, lines: Line[]): LabEvents {
  const ev: LabEvents = {};
  s.clock += dt;
  s.stars = Math.max(0, s.stars - dt);
  s.winded = Math.max(0, s.winded - dt);
  if (s.crash) {
    s.crash.t += dt;
    if (input.again) getUp(s, true);
    else if (s.crash.t >= CRASH.getUpSeconds) {
      getUp(s, false);
      standClear(s, phys);
    }
    return ev;
  }
  if (input.again) {
    getUp(s, true);
    return ev;
  }
  const raw = wobbleSteer(input.steer, s.clock, s.stars);
  s.steer += (raw - s.steer) * (1 - Math.exp(-dt * T.steerResponse));
  if (s.grounded) groundStep(s, input, dt, phys, lines, ev);
  else airStep(s, input, dt, phys, ev);
  if (s.grounded && !s.crash) standClear(s, phys, s.pitch);
  return ev;
}

// Turn in place about the middle of the body. When that would push one end into something beside the bike,
// swing round the back end instead, the way a bike turns about its rear wheel: turning away from a wall you're
// stopped against then always works, and only turning into it is refused. Stopped with the nose in a notch, the bike
// steps back to turn (below).
const swung = new THREE.Vector3();
function turn(s: LabState, phys: Physics, dYaw: number): void {
  if (dYaw === 0) return;
  if (!fitsTilted(phys, s.pos, s.yaw, s.pitch)) {
    s.yaw += dYaw; // already overlapping something: don't make it worse by refusing
    return;
  }
  // from the bike's position back to the middle of the body's rear end, along the ground
  const back = (BODY.lift + BODY.radius) * Math.sin(s.pitch) + BODY.half * Math.cos(s.pitch);
  const px = s.pos.x - Math.cos(s.yaw) * back, pz = s.pos.z + Math.sin(s.yaw) * back;
  for (const step of [dYaw, dYaw / 2]) {
    const yaw = s.yaw + step;
    if (fitsTilted(phys, s.pos, yaw, s.pitch)) {
      s.yaw = yaw;
      return;
    }
    swung.set(px + Math.cos(yaw) * back, s.pos.y, pz - Math.sin(yaw) * back);
    if (fitsTilted(phys, swung, yaw, s.pitch)) {
      s.pos.copy(swung);
      s.yaw = yaw;
      return;
    }
  }
  // Nose into a notch (between two plant clumps, say), both of those swing the nose into something and there's no
  // reverse. Stopped, the rider steps the bike back as far as it takes (up to half a metre) and turns there, so
  // turning always gets you out.
  if (s.speed > 0.5) return;
  const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
  for (const d of [0.05, 0.1, 0.2, 0.3, 0.4, 0.5]) {
    swung.set(s.pos.x - fx * d, s.pos.y, s.pos.z - fz * d);
    if (!fitsTilted(phys, swung, s.yaw, s.pitch)) return; // something behind too
    for (const step of [dYaw, dYaw / 2]) {
      if (fitsTilted(phys, swung, s.yaw + step, s.pitch)) {
        s.pos.copy(swung);
        s.yaw += step;
        return;
      }
    }
  }
}

// Move along the heading, sliding along whatever the body touches. Returns true on a crash.
// rockCrash: how hard you can hit a rock or log before it's a wipeout (on a climb, it's only a bonk)
function moveBody(s: LabState, dt: number, phys: Physics, ev: LabEvents, rockCrash = T.rockCrash): boolean {
  const dir = forward(s, dirTmp);
  const want = s.speed * dt;
  let dist = want, plowed = false;
  for (let i = 0; i < 3 && dist > 1e-6; i++) {
    const move = moveTmp.copy(dir).multiplyScalar(dist);
    const hit = sweepTilted(phys, s.pos, s.yaw, s.pitch, move);
    if (!hit) {
      s.pos.add(move);
      return false;
    }
    // already touching something and moving mostly along it: the cast says "blocked at once" (it counts the contact
    // gap) every time, which would pin you in place for good. Take the move minus any part of it into that surface,
    // as far as anything else lets you.
    // Flat normal, so it never tilts the move up; and only where the body still fits afterwards (an edge-rock wall is
    // one merged collider, so the excluded sweep can't see its next lump).
    const flat = flatTmp.set(hit.normal.x, 0, hit.normal.z);
    if (hit.toi < 1e-3 && flat.lengthSq() > 1e-4 && dir.dot(flat.normalize()) > -0.3) {
      move.addScaledVector(flat, -Math.min(0, move.dot(flat)));
      const other = sweepTilted(phys, s.pos, s.yaw, s.pitch, move, hit.collider);
      const share = other ? other.toi : 1;
      const to = toTmp.copy(s.pos).addScaledVector(move, share);
      if ((!other || other.toi > 1e-3) && fitsTilted(phys, to, s.yaw, s.pitch)) {
        s.pos.copy(to);
        if (!other) return false;
        dist *= 1 - other.toi;
        continue;
      }
    }
    s.pos.addScaledVector(move, hit.toi);
    dist *= 1 - hit.toi;
    const headOn = -dir.x * hit.normal.x - dir.z * hit.normal.z > 0.7;
    if (hit.surface === 'rock' && s.grounded && T.plowSize > 0 && headOn && !plowed) {
      // a big plush bike rides straight over a rock shorter than plowSize (met head on; grazing one slides along it)
      plowed = true;
      const ahead = BODY.half + BODY.radius + 0.15;
      const top = castDown(phys, s.pos.x + dir.x * ahead, s.pos.y + 1.5, s.pos.z + dir.z * ahead, 2);
      const rise = top ? top.height - s.pos.y : Infinity;
      if (top?.surface === 'rock' && rise > 0 && rise <= T.plowSize) {
        s.pos.y += rise + 0.01;
        ev.plow = true;
        continue;
      }
    }
    const n = nTmp.set(hit.normal.x, 0, hit.normal.z);
    if (n.lengthSq() < 1e-4) n.copy(dir).negate();
    n.normalize();
    const cosIn = Math.max(0, -dir.dot(n));
    const fresh = s.clock - s.lastWall > 0.15; // a new hit, not the same scrape continuing
    s.lastWall = s.clock;
    const into = s.speed * cosIn;
    if (fresh && into > (hit.surface === 'rock' ? rockCrash : T.wallCrash)) { // rocks and logs on a trail don't give
      const outcome: Outcome = into > T.wallBig ? 'big' : 'wipeout';
      if (hit.surface === 'rock') ev.hitRock = true;
      startCrash(s, outcome);
      ev.landed = outcome;
      return true;
    }
    if (fresh && hit.surface === 'rock' && s.grounded) turn(s, phys, bumpKick(wobbleOver(s.speed), 1, phaseOf(s)));
    if (cosIn > T.bonkCos) {
      if (fresh && into > 2) ev.bump = true;
      if (fresh && into > 0.5) ev.wallStop = true;
      s.speed = 0;
      return false;
    }
    if (fresh && into > 3.5) ev.bump = true;
    else if (s.speed > 1) ev.scrape = true;
    // keep the part of the motion along the wall
    dir.addScaledVector(n, cosIn);
    const keep = dir.length();
    if (keep < 1e-3) {
      s.speed = 0;
      return false;
    }
    dir.divideScalar(keep);
    if (fresh) s.speed *= keep;
    dist *= keep;
    // scraping along a wall turns the bike to run along it, except at a crawl while you steer the other way: then your
    // steering wins (pushing into a notch between two plant clumps, the ease swung you back each step: a trap)
    const along = Math.atan2(-dir.z, dir.x);
    const d = wrap(along - s.yaw), against = s.speed < 1 && Math.abs(s.steer) > 0.1 && d * s.steer > 0; // steer > 0 turns yaw down
    if (!against) turn(s, phys, clamp(d, -T.slideEase * dt, T.slideEase * dt));
  }
  // wedged: every way to slide out was blocked and most of the move is left. Stop, so turning in place can free you
  if (dist > 0.5 * want) s.speed = 0;
  return false;
}

// Where a trick scores (points come from lines over features). A trick in the air, the hop that starts it included,
// counts only if that air left from a feature: a flat hop scores nothing even on an open line, or hops inside a
// manual would grow the line without end. A manual counts while a line is open.
function scoreAir(s: LabState, ev: LabEvents, points: number): void {
  if (s.air?.feature) s.combo = addToCombo(s.combo, points);
  else ev.off = true;
}
function scoreManual(s: LabState, ev: LabEvents): void {
  if (s.onLine) s.combo = addToCombo(s.combo, 0);
  else ev.off = true;
}

// A combo banks once the bike has been down BANK_AFTER with no manual running
function bankIfDue(s: LabState, ev: LabEvents): void {
  if (s.manual > 0 || s.groundedFor < BANK_AFTER) return;
  s.onLine = false;
  if (s.combo.count === 0) return;
  ev.banked = comboTotal(s.combo);
  s.score += ev.banked;
  s.combo = EMPTY_COMBO;
}

function takeOff(s: LabState, vy: number, lines: Line[], ev: LabEvents, fromLip: boolean): void {
  s.grounded = false;
  // suspension soaks a lazy launch off a lip; a perfect pop keeps nearly all of it
  const perfectPop = fromLip && !!s.pendingPop && s.clock - s.pendingPop.at <= T.perfectWindow;
  const soak = fromLip ? T.popSoak * (perfectPop ? 0.15 : 1) : 0;
  s.vy = vy * (1 - soak);
  s.peakY = s.pos.y;
  s.popped = false;
  const feature = fromLip || s.surface === 'ramp';
  if (feature) {
    s.groundedFor = 0; // air off a feature keeps the line going
    s.onLine = true;
  }
  s.skid = 0;
  s.skidding = false;
  const line = fromLip ? lineFor(s, lines) : null;
  s.air = { t: 0, x: s.pos.x, z: s.pos.z, y: s.pos.y, line, pull: 1, soaked: vy * soak, feature };
  s.lipAt = fromLip ? s.clock : null;
  s.sinceLip = fromLip ? 0 : null;
  const past = s.trail[0] ?? { pos: s.pos, yaw: s.yaw };
  s.respawn = { pos: past.pos.clone(), yaw: past.yaw };
  if (fromLip && s.pendingPop) {
    const early = s.clock - s.pendingPop.at;
    if (early <= T.popBuffer) pop(s, s.pendingPop.hold, true, early <= T.perfectWindow, ev, soak);
    s.pendingPop = null;
  }
  s.air.pull = landingPull(s, line); // decided once, at takeoff
}

function hopSpeed(hold: number): number {
  const t = clamp((hold - 0.12) / 0.3, 0, 1);
  return T.hopTap + (T.hopFull - T.hopTap) * t;
}

// soak: the share of a lip pop the suspension takes (only off a lip). The hop counts only on a line (off a feature)
function pop(s: LabState, hold: number, onLip: boolean, perfect: boolean, ev: LabEvents, soak = 0): void {
  s.vy += hopSpeed(hold) * (onLip ? T.lipPop * (1 - soak) : 1) * (perfect ? T.perfectBonus : 1);
  s.popped = true;
  scoreAir(s, ev, TRICK_INFO.bunnyhop.points); // after takeOff: the hop scores by where it left from
  ev.trick = 'bunnyhop';
  ev.popped = true;
  if (onLip && perfect) ev.perfect = true;
}

// Meters to the nearest lip ahead on a line the bike is riding toward, or null.
function lipAhead(s: LabState, lines: Line[]): number | null {
  let best: number | null = null;
  for (const L of lines) {
    if (L.after > 0) continue;
    const dx = s.pos.x - L.lip.x, dz = s.pos.z - L.lip.z;
    const along = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw);
    const lateral = -dx * Math.sin(L.yaw) - dz * Math.cos(L.yaw);
    if (along < 0 && along > -8 && Math.abs(lateral) < L.width / 2 + 0.5 && Math.abs(wrap(s.yaw - L.yaw)) < 0.8 && (best === null || -along < best)) best = -along;
  }
  return best;
}

// ---- climbs (a try-out): stalling on a steep bit puts a foot down, and a step taller than the front wheel can
// roll up stops it dead unless you hop it. A hop always works, even with a foot down.
function stepAt(s: LabState, phys: Physics, ahead: number) {
  const f = forward(s, fwdTmp);
  return castDown(phys, s.pos.x + f.x * ahead, s.pos.y + PROBE_UP, s.pos.z + f.z * ahead, PROBE_DIST);
}
function footDown(s: LabState, ev: LabEvents, why: NonNullable<LabEvents['dab']>): void {
  s.dab = T.dabTime;
  s.dabs++;
  s.speed = 0;
  s.manual = 0;
  ev.dab = why;
}
// A foot that's down stays down for its time; a burnt rest lifts as soon as you've caught your breath.
function holdFoot(s: LabState, dt: number): boolean {
  if (s.dab <= 0) return false;
  s.dab -= dt;
  if (s.burntRest) s.dab = s.burnt ? Math.max(s.dab, dt) : 0; // a burnt rest lasts until the legs are back
  s.speed = 0;
  if (s.dab <= 0) {
    s.dab = 0;
    s.dabGrace = 1.2;
    s.burntRest = false;
  }
  return true;
}
// Energy, every step on the ground. Running out on an incline puts a foot down to rest; on the flat it only
// softens your legs, so you keep rolling.
// On a climb, too much stick on gravel spins the back wheel: you crawl on part of your power, and your legs spin
// freely, so it costs only that part.
function wheelSpins(s: LabState, input: LabIntent): boolean {
  return !!input.climb && !!input.loose && input.throttle > T.looseLimit && s.slope > 0.03;
}
function legsStep(s: LabState, input: LabIntent, dt: number, ev: LabEvents): void {
  const t = input.throttle, v = s.speed;
  if (v === 0 && t < -0.05) s.resting = true;
  else if (s.resting && t > -0.05) {
    s.resting = false;
    s.dabGrace = Math.max(s.dabGrace, 1.2); // getting going again from a rest doesn't stall straight away
  }
  const e: Effort = { push: Math.max(0, t) * (wheelSpins(s, input) ? T.spinPower : 1), pedaling: !input.coast && t > -0.05 && s.dab <= 0, slope: s.slope, speed: v, stopped: v === 0 && (s.resting || s.dab > 0) };
  s.energy = stepEnergy(s.energy, e, dt);
  if (!s.told.energy && s.energy < 0.5) {
    s.told.energy = true;
    ev.energyHint = true;
  }
  if (s.burnt && s.energy >= T.burntUntil) s.burnt = false;
  if (!s.burnt && s.energy <= 0) {
    s.burnt = true;
    ev.burnt = 'flat'; // soft legs; becomes a foot down below if you're grinding up a hill
  }
  // burnt and slowed to a grind (or stuck) on an incline: foot down to catch your breath. At speed (a takeoff, a
  // roller) you just carry on with soft legs; holding the brake to a stop is already a rest (let it go before the
  // legs are back and the foot goes down to finish it).
  if (s.burnt && !s.burntRest && !s.resting && s.dab <= 0 && s.slope > T.burntSlope && v < T.burntStop) {
    footDown(s, ev, 'burnt');
    s.dab = T.burntRest;
    s.burntRest = true;
    ev.burnt = 'climb';
  }
}
// Off the climb, a rock taller than the front wheel can roll up: a plush bike rides over it if it's under plowSize;
// otherwise it bucks you (half your speed) or, above rockCrash, throws you. Returns true on a crash.
function rockUnderWheel(s: LabState, phys: Physics, ev: LabEvents): boolean {
  if (s.speed < 0.5 || s.clock - s.lastWall < 0.4) return false;
  const half = WHEELBASE / 2, here = stepAt(s, phys, half), next = stepAt(s, phys, half + s.speed / 60 + 0.05);
  if (!here || !next || next.surface !== 'rock') return false;
  const rise = next.height - here.height;
  if (rise <= T.rollUp || rise > STEP_UP) return false;
  s.lastWall = s.clock;
  if (rise <= T.plowSize) {
    ev.plow = true;
    return false;
  }
  ev.hitRock = true;
  if (s.speed > T.rockCrash) {
    startCrash(s, 'wipeout');
    ev.landed = 'wipeout';
    return true;
  }
  s.speed *= CRASH.bonkKeep;
  ev.bump = true;
  turn(s, phys, bumpKick(wobbleOver(s.speed), 1, phaseOf(s)));
  return false;
}
function climbStops(s: LabState, dt: number, phys: Physics, ev: LabEvents, loose: boolean, spinning: boolean, braking: boolean): void {
  s.dabGrace = Math.max(0, s.dabGrace - dt);
  if (spinning) s.dabGrace = Math.max(s.dabGrace, 0.5); // a spinning wheel crawls but never stalls, and gets a moment to pick up speed after the gravel
  if (holdFoot(s, dt)) return;
  // the front wheel meets a step or a rock: compare the ground just under it with what it's about to reach.
  // Riding into it puts a foot down; sitting against it, pedaling just doesn't move you.
  const half = WHEELBASE / 2, here = stepAt(s, phys, half), next = stepAt(s, phys, half + Math.max(0.1, s.speed * dt + 0.05));
  const rise = here && next ? next.height - here.height : 0;
  if (rise > T.rollUp && (rise < 0.8 || next!.surface === 'rock')) {
    const rock = next!.surface === 'rock';
    if (s.speed > 0.5) footDown(s, ev, rock ? 'rock' : 'ledge'); // their own callouts, so no general bump
    else s.speed = 0;
    return;
  }
  // stalling out: just after bumping a rock, that's why; on gravel, too little push
  if (!braking && s.slope > 0.05 && s.speed > 0 && s.speed < T.dabSpeed && s.dabGrace <= 0) return footDown(s, ev, s.clock - s.lastWall < 0.4 ? 'rock' : loose ? 'loose' : 'stall');
  if (s.speed > T.dabSpeed) s.dabGrace = 0;
}

function groundStep(s: LabState, input: LabIntent, dt: number, phys: Physics, lines: Line[], ev: LabEvents): LabEvents {
  s.crouchFor = 0;
  s.tableDone = input.crouch; // a press held from the ground through the lip isn't a tabletop
  legsStep(s, input, dt, ev);
  const v = s.speed, st = s.steer;
  const brake = Math.max(0, -input.throttle);

  // turning: curvature from grip at speed, capped by the tightest turn; pulling back tightens it and slides
  // a bank leaning into the turn holds the bike up like the inside of a bowl, so berms take more speed
  const into = st > 0 ? -s.bank : s.bank;
  const kGrip = Math.max(0.3 * T.grip, T.grip + 9.8 * T.bermGrip * into) / Math.max(v * v, 0.01);
  const kCap = 1 / T.minRadius;
  const kBase = Math.min(kCap, kGrip);
  const k = Math.min(kCap, kBase * (1 + T.scrub * brake * Math.abs(st))) * st;
  const over = wobbleOver(v);
  let yawRate = v * k * steerGain(over);
  if (v < 2.5) {
    const piv = T.pivot * st * (1 - v / 2.5);
    if (Math.abs(piv) > Math.abs(yawRate)) yawRate = piv;
  }
  s.skid = v > 2.5 ? clamp(Math.abs(k) / kGrip - 1, 0, 1) : 0;
  s.skidding = s.skid > 0.15;
  const assist = lineAssist(s, lines, st);
  s.assisting = assist;
  const kick = input.rough ? bumpKick(over, 0.3, phaseOf(s)) : 0;
  turn(s, phys, (-yawRate + assist) * dt + kick);
  // the wobble: swinging the bars side to side above the bike's wobble speed builds it; at the limit it's a wipeout
  s.wobble = stepWobble(s.wobble, { over, yawJerk: (-yawRate - s.yawRate) / dt, braking: brake > 0.05, steady: Math.abs(input.steer) < 0.1 }, dt);
  s.yawRate = -yawRate;
  if (s.wobble >= T.wobbleLimit) {
    startCrash(s, 'wipeout');
    ev.landed = 'wipeout';
    ev.wobbleOut = true;
    return ev;
  }

  // speed: pedal toward the speed the stick asks for; brake only when asked; hills, pumping and drag on top
  const t = input.throttle, pedal = pedalPower(s.winded) * (s.burnt ? T.steadyLegs : 1);
  // stick up always asks for more than cruise, even if Tune has cruise above the bike's sprint
  const sprint = Math.max(T.sprint, T.cruise + SPRINT_OVER_CRUISE);
  let target = t >= 0 ? T.cruise + (sprint - T.cruise) * t : T.cruise * (1 + t);
  if (input.coast) target = Math.min(target, T.coastFloor); // the pump track: no pedaling, only a slow roll
  let braking = t < -0.05 ? 1 : 0;
  if (T.autoCorner > 0 && t < 0.3 && !input.coast) {
    const f = clamp((Math.abs(st) - 0.5) / 0.5, 0, 1) * T.autoCorner;
    if (f > 0) {
      target *= 1 - f;
      braking = Math.max(braking, 0.5); // full steer slows you gently, not like grabbing the brakes
    }
  }
  target *= pedal;
  let nv = v;
  let accel = T.pedalAccel * pedal * gearLimit(v);
  if (input.climb) {
    // On a climb your legs decide how fast you go, not the stick: the push you can make falls off as you speed
    // up, so steep pitches slow you to a crawl unless you carry speed in. Pushing the stick up stands on the
    // pedals for more. Gravel drags, so it needs some push too, but too much and the back wheel spins: you
    // crawl on part of your power, but you never stall out (climbStops doesn't put a foot down for it).
    const spinning = wheelSpins(s, input);
    const effort = (t > (input.loose ? T.looseMin : 0.3) ? 1 : T.steadyLegs) * (spinning ? T.spinPower : 1);
    accel = Math.min(accel, (T.legs * effort * pedal) / Math.max(v, 0.6));
    if (input.loose) nv -= T.looseDrag * dt;
    if (spinning) ev.spinout = true;
  }
  if (nv < target) nv = Math.min(target, nv + accel * dt);
  else if (braking) nv = Math.max(target, nv - T.brake * braking * clamp((nv - target) / 1.5, 0.25, 1) * dt);
  nv -= T.slopeG * Math.sin(s.slope) * Math.cos(s.slope) * dt;
  // pumping: pressing down on a downhill turns the drop into speed; pressing on an uphill (except up a takeoff,
  // where it loads the pop) fights it, so timing beats holding the whole way
  if (input.crouch && s.slope < -0.03) {
    nv += T.pump * Math.sin(-s.slope) * dt;
    s.pumped = true;
    ev.pumping = true;
  } else if (input.crouch && s.slope > 0.03 && lipAhead(s, lines) === null) nv -= T.pump * T.pumpCost * Math.sin(s.slope) * dt;
  const grassy = s.surface === 'grass' || s.surface === 'tallgrass', loose = grassy ? 2 : s.surface === 'dirt' ? 1.5 : 1;
  const drag = s.surface === 'grass' ? T.grassDrag : s.surface === 'tallgrass' ? T.tallGrassDrag : 0;
  nv -= (T.rolling * loose + drag + T.airDrag * nv * nv) * dt;
  nv -= T.skidDecel * s.skid * dt;
  s.speed = clamp(nv, 0, T.maxSpeed);
  // a landed trick's burst: extra push on top of pedaling, not held down by the pedaling targets. It's counted
  // after every limit above, so only speed that really stuck is tracked, and bleeding it back never takes
  // more than it gave (once it ends, what it added drains away fast, so it stays a burst)
  if (braking) s.boostGain = 0; // brakes take the extra speed first
  if (s.boost > 0) {
    const add = Math.min((s.boostPush / T.trickBoostTime) * dt, Math.max(0, T.maxSpeed - s.speed));
    s.speed += add;
    s.boostGain += add;
    s.boost = Math.max(0, s.boost - dt);
  } else if (s.boostGain > 0) {
    const bled = Math.min(s.boostGain * (1 - Math.exp(-dt / BOOST_BLEED)), s.speed);
    s.speed -= bled;
    s.boostGain = s.boostGain < 0.01 ? 0 : s.boostGain - bled;
  }

  // manual
  if (input.swipe && trickForSwipe(input.swipe, true) === 'manual' && s.manual <= 0) {
    s.manual = 3;
    if (s.surface === 'ramp') s.onLine = true; // a manual on the plank or a kicker starts a line
    scoreManual(s, ev);
    ev.trick = 'manual';
  }
  if (s.manual > 0) {
    s.manual = Math.max(0, s.manual - dt);
    if (!s.onLine && s.surface === 'ramp') { // rolled onto the plank in a manual: that starts the line
      s.onLine = true;
      s.combo = addToCombo(s.combo, 0);
    }
    if (s.onLine) s.combo = { ...s.combo, points: s.combo.points + TRICK_INFO.manual.points * dt };
  }

  // anything below that slows the bike (a foot down, a rock, a wall scrub) takes the burst's share with it
  let pre = s.speed;
  const owe = () => {
    if (s.boostGain > 0 && s.speed < pre) s.boostGain = pre > 0 ? (s.boostGain * s.speed) / pre : 0;
    pre = s.speed;
  };
  if (input.climb) climbStops(s, dt, phys, ev, !!input.loose, !!ev.spinout, t < -0.05);
  else {
    holdFoot(s, dt);
    if (rockUnderWheel(s, phys, ev)) {
      owe();
      return ev;
    }
  }
  owe();
  if (moveBody(s, dt, phys, ev, input.climb ? T.wallCrash : T.rockCrash)) {
    owe();
    return ev;
  }
  owe();
  if (input.climb && ev.wallStop && s.dabGrace <= 0) footDown(s, ev, 'rock'); // rode into a rock: the body stops before the front wheel sees it

  // Follow the ground under the middle of the bike. Its slope gives the bike's vertical speed, so a takeoff
  // carries exactly the lip's angle. Leave the ground where it falls away faster than gravity can pull the
  // bike after it: lips, knuckles, sharp crests. Small steps down are rolled; bigger ones are ridden off.
  const fwd = forward(s, fwdTmp);
  const center = castDown(phys, s.pos.x, s.pos.y + PROBE_UP, s.pos.z, PROBE_DIST);
  if (!center || center.height < s.pos.y - DROP) {
    takeOff(s, Math.max(0, s.vyGround), lines, ev, s.vyGround > MIN_LAUNCH);
    return ev;
  }
  // a probe that lands on a near-vertical face (a rock's side) isn't ground to ride: keep the height and slope you had,
  // or tan(slope) turns it into a launch into the sky
  const face = center.normal.y < 0.5;
  const h = face || center.height > s.pos.y + STEP_UP ? s.pos.y : center.height;
  const slope = face ? s.slope : Math.atan2(-(center.normal.x * fwd.x + center.normal.z * fwd.z), center.normal.y);
  const vyNow = s.speed * Math.tan(slope);
  // holding the crouch absorbs crests, like a rider soaking up a roller to stay low and pump it
  if ((s.vyGround - vyNow) / dt > T.gDown * T.stick * (input.crouch ? 1.8 : 1)) {
    s.pos.y = Math.max(h, s.pos.y + s.vyGround * dt); // carry on along the line the bike was riding
    takeOff(s, s.vyGround, lines, ev, s.vyGround > MIN_LAUNCH);
    return ev;
  }
  s.slope = slope;
  s.bank = (-center.normal.x * Math.sin(s.yaw) - center.normal.z * Math.cos(s.yaw)) / Math.max(0.2, center.normal.y);
  s.vyGround = vyNow;
  s.vy = vyNow;
  s.pos.y = h;
  s.groundY = h;
  s.surface = center.surface;
  // the bike's tilt, for looks and its body: from the wheels when both are near the ground, else the slope
  const half = WHEELBASE / 2;
  const front = castDown(phys, s.pos.x + fwd.x * half, s.pos.y + PROBE_UP, s.pos.z + fwd.z * half, PROBE_DIST);
  const rear = castDown(phys, s.pos.x - fwd.x * half, s.pos.y + PROBE_UP, s.pos.z - fwd.z * half, PROBE_DIST);
  const near = (g: typeof front) => g !== null && Math.abs(g.height - h) < 0.7;
  s.pitch = near(front) && near(rear) ? Math.atan2(front!.height - rear!.height, WHEELBASE) : slope;

  // hop: on a takeoff, remember it for the lip; anywhere else, hop now. A press that pumped was a pump, so
  // letting go of it only pops at a lip.
  const wasPump = s.pumped;
  if (!input.crouch) s.pumped = false;
  if (input.hop !== null) {
    const toLip = lipAhead(s, lines);
    if (toLip !== null && T.popBuffer > 0 && toLip / Math.max(s.speed, 1) <= T.popBuffer + 0.05) {
      s.pendingPop = { hold: input.hop, at: s.clock };
    } else if (!wasPump) {
      if (input.climb || s.speed < 1) {
        s.speed = Math.max(s.speed, T.hopPush); // lift the front and shove: how you get up a ledge or over a log from a stop
        s.dab = 0;
      }
      bankIfDue(s, ev); // a hop on the landing step skips the check below
      takeOff(s, Math.max(0, s.vyGround), lines, ev, false);
      pop(s, input.hop, s.vyGround > 0.5, false, ev);
      return ev;
    }
  }
  if (s.pendingPop && s.clock - s.pendingPop.at > T.popBuffer + 0.1) s.pendingPop = null;

  s.groundedFor += dt;
  bankIfDue(s, ev);
  s.trailClock += dt;
  if (s.trailClock >= 0.25) {
    s.trailClock = 0;
    s.trail.push({ pos: s.pos.clone(), yaw: s.yaw });
    if (s.trail.length > 6) s.trail.shift();
  }
  return ev;
}

function timeToFall(height: number, vy: number): number {
  const g = T.gDown, disc = vy * vy + 2 * g * height;
  return disc < 0 ? Infinity : (vy + Math.sqrt(disc)) / g;
}

function airStep(s: LabState, input: LabIntent, dt: number, phys: Physics, ev: LabEvents): LabEvents {
  const air = s.air ?? (s.air = { t: 0, x: s.pos.x, z: s.pos.z, y: s.pos.y, line: null, pull: 1, soaked: 0, feature: false });
  air.t += dt;
  if (!air.feature) s.groundedFor += dt; // air that isn't off a feature doesn't keep the line going
  if (s.sinceLip !== null) s.sinceLip += dt;
  s.energy = stepEnergy(s.energy, { push: 0, pedaling: false, slope: 0, speed: s.speed, stopped: false }, dt);
  // a late pop, just after the lip, still counts
  if (input.hop !== null && !s.popped && s.lipAt !== null && s.clock - s.lipAt <= T.perfectWindow) {
    // a late perfect pop: the suspension gives back most of what it soaked at the lip
    pop(s, input.hop, true, true, ev, T.popSoak * 0.15);
    s.vy += air.soaked * 0.85;
    air.soaked = 0;
    air.pull = landingPull(s, air.line);
  }
  // swipes: up a no-hander, down a backflip, left or right a 360. Holding the jump button: a tabletop, once a
  // press has gone on long enough that it can't be the start of a swipe.
  if (input.swipe && !s.trick && !s.move) {
    const move = airMove(input.swipe);
    if (move) s.move = { id: move, t: 0, dir: input.swipe === 'left' ? 1 : -1 };
    else s.trick = { id: 'nohander', t: 0 };
  }
  if (input.crouch) s.crouchFor += dt;
  else {
    s.crouchFor = 0;
    s.tableDone = false;
  }
  if (input.crouch && !s.tableDone && s.crouchFor >= 0.15 && !s.trick && !s.move) {
    s.trick = { id: 'tabletop', t: 0 };
    s.tableDone = true;
  }
  if (s.move) {
    s.move.t += dt * s.bike.spin;
    if (s.move.t >= MOVE_INFO[s.move.id].seconds()) {
      scoreAir(s, ev, MOVE_INFO[s.move.id].points);
      s.airPts += MOVE_INFO[s.move.id].points;
      ev.move = s.move.id;
      s.move = null;
    }
  }
  if (s.trick) {
    s.trick.t += dt * s.bike.spin;
    if (s.trick.t >= TRICK_INFO[s.trick.id].seconds) {
      scoreAir(s, ev, TRICK_INFO[s.trick.id].points);
      s.airPts += TRICK_INFO[s.trick.id].points;
      ev.trick = s.trick.id;
      s.trick = null;
    }
  }
  turn(s, phys, -s.steer * T.airSteer * dt);
  s.vy -= (s.vy > T.floatBand ? T.gUp : s.vy > -T.floatBand ? T.gFloat : T.gDown) * dt;

  // landing pull: fly a little faster or slower so the landing comes down on the slope
  const speed = s.speed;
  s.speed = speed * air.pull;
  const crashed = moveBody(s, dt, phys, ev);
  s.speed = s.speed === speed * air.pull ? speed : s.speed / air.pull;
  if (crashed) return ev;

  s.pos.y += s.vy * dt;
  s.peakY = Math.max(s.peakY, s.pos.y);
  const fwd = forward(s, fwdTmp);
  const below = castDown(phys, s.pos.x, s.pos.y + PROBE_UP, s.pos.z, PROBE_DIST + 40);
  const groundY = below ? below.height : -1000;
  const gp = below ? Math.atan2(-(below.normal.x * fwd.x + below.normal.z * fwd.z), below.normal.y) : 0;
  s.groundY = groundY;
  const assist = s.autoLand && timeToFall(s.pos.y - groundY, s.vy) < 0.35;
  const target = assist ? gp : Math.atan2(s.vy, Math.max(1, s.speed)) * 0.6;
  s.pitch += -input.throttle * T.airPitch * dt + (target - s.pitch) * (1 - Math.exp(-dt * (assist ? 6 : 1.5)));
  if (!below || s.pos.y > groundY) return ev;

  // touchdown: the velocity splits into speed along the slope and a thump into it
  const along = s.speed * Math.cos(gp) + s.vy * Math.sin(gp);
  const impact = Math.abs(-s.speed * Math.sin(gp) + s.vy * Math.cos(gp));
  // a 360 or backflip that isn't all the way round: nearly round lands it, else what's left is how far off
  // straight the bike comes down
  let moveLeft = 0;
  if (s.move) {
    const k = Math.min(1, s.move.t / MOVE_INFO[s.move.id].seconds());
    moveLeft = 360 * (1 - k * k * (3 - 2 * k));
    if (moveLeft <= CRASH.cleanDeg + CRASH.assistDeg) {
      scoreAir(s, ev, MOVE_INFO[s.move.id].points);
      s.airPts += MOVE_INFO[s.move.id].points;
      ev.move = s.move.id;
      moveLeft = 0;
    } else {
      ev.short = s.move.id; // not enough air for it
      ev.shortPopped = s.popped;
    }
    s.move = null;
  }
  let outcome = classifyLanding({
    angleErrorDeg: (Math.abs(s.pitch - gp) * 180) / Math.PI + moveLeft,
    fallHeight: s.peakY - groundY,
    impactSpeed: impact,
    trickUnfinished: s.trick !== null,
    autoLand: s.autoLand,
  });
  // bottoming out: a landing harder than the bike's travel can take clunks (anywhere) and, on flat ground, loses a little
  // speed (today's heavy landing, now set by travel); well past it, a bobble. Speed loss stays flat-only: dropping the
  // gate slowed slope landings on robot best rides (Whoop-de-Doo, the tables), see checks/landing-whatif.ts
  const used = impact / landingCapacity(kitOf(s.bike), T), tier = bottomTier(used, T.bottomMargin);
  if (tier === 'slammed' && outcome === 'clean') outcome = 'bobble';
  const before = s.speed;
  let after = before + T.landBoost * (Math.max(0, along) * Math.cos(gp) - before);
  if (tier !== 'within' && Math.abs(gp) < 0.1) after *= T.flatKeep;
  ev.used = used;
  ev.bottomed = tier !== 'within';
  s.speed = clamp(Math.max(0, after), 0, T.maxSpeed);
  const dist = Math.hypot(s.pos.x - air.x, s.pos.z - air.z);
  if (air.t > 0.25) s.lastJump = { air: air.t, height: s.peakY - air.y, dist };
  ev.impact = impact;
  ev.boost = s.speed - before;
  ev.airTime = air.t;
  ev.slope = gp;
  s.pos.y = groundY;
  s.grounded = true;
  s.vy = 0;
  s.vyGround = s.speed * Math.tan(gp);
  s.pitch = gp;
  s.slope = gp;
  s.sinceLip = null;
  s.lipAt = null;
  s.surface = below.surface;
  s.trick = null;
  s.air = null;
  ev.landed = outcome;
  // a sketchy landing above your wobble speed knocks the heading; a clean one on a proper landing doesn't
  if (outcome === 'bobble') turn(s, phys, bumpKick(wobbleOver(s.speed), Math.min(1.5, impact / 6), phaseOf(s)));
  if (outcome === 'bobble') s.speed *= CRASH.bobbleSpeedKeep;
  if (outcome === 'wipeout' || outcome === 'big') startCrash(s, outcome);
  // a clean landing after a finished trick or move starts the burst; bigger tricks push more
  if (outcome === 'clean' && T.trickBoost > 0 && s.airPts > 0) {
    s.boost = T.trickBoostTime;
    s.boostGain = 0;
    s.boostPush = T.trickBoost * Math.min(1, s.airPts / 400);
  }
  s.airPts = 0;
  return ev;
}
