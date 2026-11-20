// The lab bike on a small test yard: a long flat dirt strip and, beside it, a 12% ramp.
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createPhysics, type Physics } from '../src/world/physics';
import { createLabState, placeBike, stepLab, resetRide, type LabIntent, type LabEvents, type LabState } from '../src/lab/bike';
import { LAB_BIKES, applyBike, type LabBikeId } from '../src/lab/bikes';
import { T, DEFAULTS } from '../src/lab/tune';
import { fitsTilted } from '../src/lab/body';
import { TRICK_INFO } from '../src/rules/tricks';

const DT = 1 / 60, RAMP = Math.atan(0.12), RAMP_Z = 40, KICK_Z = -40, KICK_X = 30, ROCK_Z = -80, GRAZE_Z = -110;
const LIP_X = KICK_X + 2.5 * Math.cos((25 * Math.PI) / 180), LIP_Y = 2.5 * Math.sin((25 * Math.PI) / 180);
const CHANNEL = { x: 220, z: -6, half: 0.29 };
const CLUMP = { x: 280, z: 6, r: 0.45 }, NOTCH = { x: 250, z: [5.4, 6.65], r: 0.55 };
const LIP = { lip: new THREE.Vector3(LIP_X, LIP_Y, KICK_Z), yaw: 0, width: 3, after: 0 };
let phys: Physics;

async function yard(): Promise<Physics> {
  const root = new THREE.Group();
  const flat = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 20));
  flat.position.set(100, -0.5, 0);
  flat.userData.collide = 'dirt';
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(120, 1, 20));
  const c = Math.cos(RAMP), s = Math.sin(RAMP);
  ramp.rotation.z = RAMP;
  ramp.position.set(60 * c + 0.5 * s, 60 * s - 0.5 * c, RAMP_Z);
  ramp.userData.collide = 'dirt';
  // a strip with a 25° kicker (lip 1.06 m up) and a strip with two rocks across it, 0.3 m and 0.5 m tall
  const kickStrip = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 10));
  kickStrip.position.set(100, -0.5, KICK_Z);
  kickStrip.userData.collide = 'dirt';
  const kick = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 3));
  const a = (25 * Math.PI) / 180;
  kick.rotation.z = a;
  kick.position.set(KICK_X + 1.25 * Math.cos(a) + 0.5 * Math.sin(a), 1.25 * Math.sin(a) - 0.5 * Math.cos(a), KICK_Z);
  kick.userData.collide = 'ramp';
  const rockStrip = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 10));
  rockStrip.position.set(100, -0.5, ROCK_Z);
  rockStrip.userData.collide = 'dirt';
  const small = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 10));
  small.position.set(30, 0.15, ROCK_Z);
  small.userData.collide = 'rock';
  const big = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 10));
  big.position.set(30, 0.25, ROCK_Z + 20);
  big.userData.collide = 'rock';
  const bigStrip = rockStrip.clone();
  bigStrip.position.z = ROCK_Z + 20;
  bigStrip.userData.collide = 'dirt';
  // a low rock bar angled a little across the line: the body grazes its side, it isn't met head on
  const grazeStrip = rockStrip.clone();
  grazeStrip.position.z = GRAZE_Z;
  grazeStrip.userData.collide = 'dirt';
  const bar = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 0.4));
  bar.position.set(35, 0.15, GRAZE_Z + 0.9);
  bar.rotation.y = 0.08; // its near side reaches the line from about x 40 and crosses it by x 45
  bar.userData.collide = 'rock';
  // further along the same strip, a V of tall rocks to ride into: no way to slide out of its point
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.4));
    arm.position.set(77, 0.5, GRAZE_Z + side * 0.6);
    arm.rotation.y = side * 0.2;
    arm.userData.collide = 'rock';
    root.add(arm);
  }
  // far down the flat, off to one side: a firm plant clump as the trails have them (an open-topped cylinder)
  const clump = new THREE.Mesh(new THREE.CylinderGeometry(CLUMP.r, CLUMP.r, 1.2, 8, 1, true));
  clump.position.set(CLUMP.x, 0.4, CLUMP.z);
  clump.userData.collide = 'rock';
  root.add(clump);
  // and a pair of clumps as a trail's edge line has them (1.25 m apart): the notch between them fits the bike's nose
  for (const z of NOTCH.z) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(NOTCH.r, NOTCH.r, 1.2, 8, 1, true));
    c.position.set(NOTCH.x, 0.4, z);
    c.userData.collide = 'rock';
    root.add(c);
  }
  // a channel a hair narrower than the body between two rock walls (an edge rock and the clump line outside it)
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.2));
    wall.position.set(CHANNEL.x + 3, 0.6, CHANNEL.z + side * (CHANNEL.half + 0.1));
    wall.userData.collide = 'rock';
    root.add(wall);
  }
  root.add(flat, ramp, kickStrip, kick, rockStrip, small, big, bigStrip, grazeStrip, bar);
  root.updateMatrixWorld(true);
  return createPhysics(root);
}

function bikeAt(id: LabBikeId, where: 'flat' | 'ramp' | 'kick' | 'rock' | 'bigRock' | 'graze', x = 10, speed = 0): LabState {
  Object.assign(T, DEFAULTS);
  applyBike(id);
  const y = where === 'ramp' ? x * Math.tan(RAMP) : 0;
  const z = { flat: 0, ramp: RAMP_Z, kick: KICK_Z, rock: ROCK_Z, bigRock: ROCK_Z + 20, graze: GRAZE_Z }[where];
  const pos = new THREE.Vector3(x, y + 0.02, z);
  const st = createLabState(LAB_BIKES[id], pos, 0);
  placeBike(st, pos.clone(), 0);
  st.speed = speed;
  // settle onto the ground
  for (let i = 0; i < 3; i++) stepLab(st, intent({ throttle: speed > 0 ? 0 : -1 }), DT, phys, []);
  st.speed = speed;
  return st;
}
function intent(o: Partial<LabIntent> = {}): LabIntent {
  return { steer: 0, throttle: 0, hop: null, swipe: null, again: false, crouch: false, ...o };
}
function ride(s: LabState, i: Partial<LabIntent>, seconds: number, each?: (ev: LabEvents, s: LabState) => void): LabEvents[] {
  const out: LabEvents[] = [];
  for (let n = 0; n < seconds / DT; n++) {
    const ev = stepLab(s, intent(i), DT, phys, []);
    out.push(ev);
    each?.(ev, s);
  }
  return out;
}

beforeEach(async () => {
  phys ??= await yard();
});

describe('energy on the bike', () => {
  it('burning out on the flat never stops you', () => {
    const s = bikeAt('bolinas', 'flat', 10, 8);
    s.energy = 0.02;
    let minSpeed = Infinity;
    const evs = ride(s, { throttle: 1 }, 3, (_, st) => (minSpeed = Math.min(minSpeed, st.speed)));
    expect(evs.filter((e) => e.burnt === 'flat').length).toBe(1);
    expect(evs.some((e) => e.dab)).toBe(false);
    expect(minSpeed).toBeGreaterThan(4);
    expect(s.burnt).toBe(true);
  });

  it('burning out on a climb puts a foot down and rests until the legs are back', () => {
    const s = bikeAt('bolinas', 'ramp', 10, 3);
    T.burntRest = 0.5; // shorter than the refill: the rest still lasts until energy is back to burntUntil
    s.energy = 0.02;
    let dabbed = false, rested = 0, ended = false;
    ride(s, { throttle: 1, climb: true }, 6, (ev, st) => {
      if (ev.dab === 'burnt') dabbed = true;
      if (dabbed && !ended) {
        if (st.dab > 0) {
          rested += DT;
          expect(st.speed).toBe(0);
        } else {
          ended = true;
          expect(st.energy).toBeGreaterThanOrEqual(T.burntUntil - 0.01);
        }
      }
    });
    expect(dabbed).toBe(true);
    expect(ended).toBe(true);
  });

  it('burnt and stuck at a standstill on a climb puts a foot down and gets the legs back', () => {
    const s = bikeAt('bolinas', 'ramp', 10, 0);
    T.legs = 0.5; // too weak to get going up the ramp
    T.pedalAccel = 0.5;
    s.energy = 0;
    s.burnt = true;
    let dabbed = false;
    ride(s, { throttle: 1, climb: true }, 4, (ev) => {
      if (ev.dab === 'burnt') dabbed = true;
    });
    expect(dabbed).toBe(true);
    expect(s.energy).toBeGreaterThan(0.3);
  });

  it('spinning the back wheel on gravel costs less than pushing hard on dirt', () => {
    const run = (loose: boolean) => {
      const s = bikeAt('enduro', 'ramp', 10, 2);
      ride(s, { throttle: 1, climb: true, loose }, 1.5);
      return s.energy;
    };
    expect(run(true)).toBeGreaterThan(run(false) + 0.03);
  });

  it('burning out at speed on a takeoff never stops you dead', () => {
    const s = bikeAt('enduro', 'kick', KICK_X - 3, 8);
    T.cruise = 8;
    const evs: LabEvents[] = [];
    for (let n = 0; n < 120 && s.grounded; n++) {
      if (s.slope > 0.2 && s.energy > 0.01) s.energy = 0.0001; // runs out on the takeoff face
      evs.push(stepLab(s, intent({ throttle: 1 }), DT, phys, [LIP]));
    }
    expect(evs.some((e) => e.burnt)).toBe(true);
    expect(evs.some((e) => e.dab)).toBe(false);
    expect(s.grounded).toBe(false);
  });

  it('burnt in the air waits for the ground', () => {
    const s = bikeAt('bolinas', 'flat', 10, 6);
    s.energy = 0;
    stepLab(s, intent({ hop: 0.4 }), DT, phys, []);
    expect(s.grounded).toBe(false);
    ride(s, {}, 2, (ev, st) => {
      expect(ev.dab).toBeUndefined();
      if (ev.burnt) expect(st.grounded).toBe(true);
    });
  });

  it('braking to a stop on a hill holds still and refills fastest', () => {
    const s = bikeAt('bolinas', 'ramp', 10, 3);
    s.energy = 0.2;
    const evs = ride(s, { throttle: -1, climb: true }, 2);
    expect(evs.some((e) => e.dab)).toBe(false);
    expect(s.speed).toBe(0);
    const at = s.pos.clone(), before = s.energy;
    ride(s, { throttle: -1, climb: true }, 1);
    expect(s.pos.distanceTo(at)).toBeLessThan(0.01);
    expect(s.resting).toBe(true);
    expect(s.energy - before).toBeGreaterThan(T.energyRefill * 1.2);
  });

  it('restart after a rest gets the stall grace', () => {
    const s = bikeAt('bolinas', 'ramp', 10, 3);
    ride(s, { throttle: -1, climb: true }, 3);
    expect(s.resting).toBe(true);
    const evs = ride(s, { throttle: 1, climb: true }, 0.5);
    expect(evs.some((e) => e.dab)).toBe(false);
    expect(s.resting).toBe(false);
  });

  it('placeBike fills the tank; getting up after a crash does not', () => {
    const s = bikeAt('bolinas', 'flat');
    s.energy = 0.1;
    s.burnt = true;
    placeBike(s, s.pos.clone(), 0);
    expect(s.energy).toBe(1);
    expect(s.burnt).toBe(false);
    s.energy = 0.4;
    s.crash = { outcome: 'wipeout', t: 0 };
    ride(s, {}, 2.2);
    expect(s.crash).toBeNull();
    expect(s.energy).toBeCloseTo(0.4, 1);
  });

  // The crash tumble can come to rest against (or inside) a plant clump where the riding body doesn't fit; getting up
  // there would leave every move blocked (Hairpin Hollow, Nov 13: stuck in the bushes after a crash at a switchback).
  it('getting up after a crash puts you where the bike fits, and you can ride away', () => {
    const s = bikeAt('bolinas', 'flat', 10);
    s.pos.set(CLUMP.x, 0.02, CLUMP.z - CLUMP.r - 0.1); // where the tumble stopped: the body half inside the clump
    s.yaw = 0.4;
    expect(fitsTilted(phys, s.pos, s.yaw, 0)).toBe(false);
    s.crash = { outcome: 'wipeout', t: 0 };
    ride(s, {}, 2.2);
    expect(s.crash).toBeNull();
    expect(fitsTilted(phys, s.pos, s.yaw, 0)).toBe(true);
    expect(Math.hypot(s.pos.x - CLUMP.x, s.pos.z - (CLUMP.z - CLUMP.r - 0.1))).toBeLessThan(1.5); // near where you fell
    const from = s.pos.clone();
    ride(s, { throttle: 1 }, 2);
    expect(s.pos.distanceTo(from)).toBeGreaterThan(3);
  });

  // In the air the body moves sideways by a sweep but up and down by a plain step, so dropping onto a clump from just
  // above it landed the body over its open top: overlapping, every move blocked (Henry, Nov 13: stuck in the bushes
  // after cutting down the hill)
  it('landing on a clump from above never leaves you overlapping it', () => {
    for (const dx of [-0.6, -0.3, 0, 0.3]) {
      const s = bikeAt('bolinas', 'flat', 10);
      const pos = new THREE.Vector3(CLUMP.x + dx, 1.15, CLUMP.z);
      Object.assign(s, { grounded: false, vy: -1, speed: 0.5 });
      s.pos.copy(pos);
      s.yaw = 0;
      ride(s, {}, 1.5);
      expect(s.grounded || !!s.crash).toBe(true);
      if (s.crash) ride(s, {}, 2.2);
      expect(fitsTilted(phys, s.pos, s.yaw, 0), `dx ${dx}`).toBe(true);
    }
  });

  // Nose into the gap between two clumps, every turn swung the nose into one or the other and there's no reverse: a
  // trap (Hairpin Hollow, Nov 13, cutting down the hill). Turning always gets you out: the bike steps back to turn.
  it('nose stuck between two clumps, steering either way turns you out', () => {
    for (const [yaw, steer] of [[0, 1], [0, -1], [0.45, 1], [0.45, -1], [-0.45, 1], [-0.45, -1]]) {
      const s = bikeAt('hardtail', 'flat', 10);
      s.pos.set(NOTCH.x - 3, 0.02, 6.02);
      s.yaw = yaw;
      ride(s, { throttle: 1, steer: -Math.sin(yaw) * 2 }, 3); // ride into the notch
      ride(s, { throttle: 1 }, 1);
      const stuckAt = s.pos.clone();
      ride(s, { throttle: 1, steer }, 5);
      expect(s.pos.distanceTo(stuckAt), `yaw ${yaw} steer ${steer}`).toBeGreaterThan(1);
    }
  });

  // The fit check uses a slimmer body than the sweeps (so resting against a wall still fits), so a body pressed into
  // something by a few cm fits but every move is blocked at once. Touching on both sides, sliding along one can't help:
  // a trap (Boulder Dash's edge, between an edge rock and the clump line, Nov 13).
  it('squeezed into a channel a hair narrower than the body, pedaling still rides you out', () => {
    const s = bikeAt('hardtail', 'flat', 10);
    s.pos.set(CHANNEL.x + 1, 0, CHANNEL.z);
    s.yaw = 0;
    expect(fitsTilted(phys, s.pos, s.yaw, 0)).toBe(true);
    ride(s, { throttle: 1 }, 3);
    expect(s.pos.x - (CHANNEL.x + 1)).toBeGreaterThan(3);
  });

  it('the dirt jumper tops out at its gear on the flat', () => {
    const s = bikeAt('dirtjumper', 'flat', 10, 0);
    let top = 0;
    ride(s, { throttle: 1 }, 15, (_, st) => (top = Math.max(top, st.speed)));
    expect(top).toBeLessThanOrEqual(T.gearTop + 0.3);
    expect(top).toBeGreaterThan(T.gearTop - 1);
  });

  it('says once that pushing hard uses energy', () => {
    const s = bikeAt('dirtjumper', 'flat', 10, 6); // energyCost 1: half a tank goes in about 5 s of sprint
    const evs = ride(s, { throttle: 1 }, 12);
    expect(evs.filter((e) => e.energyHint).length).toBe(1);
  });
});

describe('speed wobble on the bike', () => {
  // hold the speed up: no gear limit, a sprint above the wobble line
  const fast = (id: LabBikeId) => {
    const s = bikeAt(id, 'flat', -60, 12);
    T.gearTop = 0;
    T.sprint = 12.5;
    return s;
  };
  const weave = (s: LabState, throttle: number, seconds: number) =>
    ride(s, { throttle, rough: true, steer: 0 }, 0).concat(
      Array.from({ length: Math.round(seconds / DT) }, (_, n) => stepLab(s, intent({ throttle, rough: true, steer: Math.floor((n * DT) / 0.3) % 2 ? -1 : 1 }), DT, phys, [])),
    );

  it('the dirt jumper weaving fast on rough ground wobbles out', () => {
    const s = fast('dirtjumper');
    expect(weave(s, 1, 3).some((e) => e.wobbleOut)).toBe(true);
  });

  it('braking below the wobble speed saves it', () => {
    const s = fast('dirtjumper');
    expect(weave(s, -1, 3).some((e) => e.wobbleOut)).toBe(false);
  });

  it('the enduro shrugs off the same ride', () => {
    const s = fast('enduro');
    expect(weave(s, 1, 3).some((e) => e.wobbleOut)).toBe(false);
  });

  it('a clean landing above the wobble speed keeps the heading', () => {
    const s = bikeAt('bolinas', 'kick', 10, 8);
    T.wobbleSpeed = 2; // well over it at the lip, with a hard kick
    T.wobbleKick = 1.5;
    let landed: string | undefined;
    ride(s, { throttle: 0 }, 5, (ev) => {
      if (ev.landed && !landed) landed = ev.landed;
    });
    expect(landed).toBe('clean');
    expect(Math.abs(s.yaw)).toBeLessThan(0.01);
  });

  it('a bike swap clears the wobble and keeps the energy', () => {
    const s = fast('dirtjumper');
    s.wobble = 0.7;
    s.energy = 0.4;
    resetRide(s);
    expect(s.wobble).toBe(0);
    expect(s.energy).toBe(0.4);
  });
});

describe('the enduro soaks a lazy pop and plows small rocks', () => {
  // ride at the kicker at a steady speed; pop (perfect timing) or roll it; the upward speed leaving the lip
  function launch(id: LabBikeId, popIt: boolean, soak?: number): number {
    const s = bikeAt(id, 'kick', KICK_X - 15, 7);
    if (soak !== undefined) T.popSoak = soak;
    T.cruise = 7;
    let popped = false;
    for (let n = 0; n < 600; n++) {
      const hop = popIt && !popped && LIP_X - s.pos.x < s.speed * 0.08 ? 0.45 : null;
      if (hop !== null) popped = true;
      stepLab(s, intent({ hop }), DT, phys, [LIP]);
      if (!s.grounded) return s.vy;
    }
    throw new Error('never left the lip');
  }

  it('the enduro rolled off a lip gets less air than the Bolinas', () => {
    expect(launch('enduro', false)).toBeLessThanOrEqual(0.65 * launch('bolinas', false));
  });

  it('a perfect pop gets the enduro most of its air back', () => {
    expect(launch('enduro', true)).toBeGreaterThanOrEqual(0.9 * launch('enduro', true, 0));
  });

  it('a hop on the flat is the same with or without soak', () => {
    const hop = (soak: number) => {
      const s = bikeAt('enduro', 'flat', 10, 4);
      T.popSoak = soak;
      stepLab(s, intent({ hop: 0.45 }), DT, phys, []);
      return s.vy;
    };
    expect(hop(0.4)).toBeCloseTo(hop(0), 5);
  });

  function hitRock(id: LabBikeId, where: 'rock' | 'bigRock'): LabEvents[] {
    const s = bikeAt(id, where, 20, 7);
    T.cruise = 7;
    return ride(s, {}, 3);
  }

  it('the enduro rides through a small rock the dirt jumper crashes on', () => {
    const en = hitRock('enduro', 'rock');
    expect(en.some((e) => e.plow)).toBe(true);
    expect(en.some((e) => e.landed === 'wipeout' || e.landed === 'big')).toBe(false);
    expect(hitRock('dirtjumper', 'rock').some((e) => e.landed === 'wipeout' || e.landed === 'big')).toBe(true);
  });

  it('grazing the side of a low rock slides along it on every bike, never pins you in place', () => {
    for (const id of ['enduro', 'bolinas'] as const) {
      const s = bikeAt(id, 'graze', 15, 5);
      T.cruise = 5;
      let touched = false;
      ride(s, {}, 8, (ev) => {
        if (ev.scrape || ev.plow || ev.bump || ev.wallStop) touched = true;
      });
      expect(touched, id).toBe(true);
      expect(s.pos.x, id).toBeGreaterThan(50);
    }
  });

  it('wedged into a corner with no way to slide out, the bike stops instead of holding its speed', () => {
    const s = bikeAt('bolinas', 'graze', 66, 3);
    T.cruise = 3;
    ride(s, {}, 4);
    expect(s.pos.x).toBeGreaterThan(73); // got into the V
    expect(s.speed).toBeLessThan(0.5);
  });

  it('a rock bigger than plowSize still bonks the enduro', () => {
    const en = hitRock('enduro', 'bigRock');
    expect(en.some((e) => e.plow)).toBe(false);
    expect(en.some((e) => e.bump || e.wallStop)).toBe(true);
  });
});

describe('tricks on physics', () => {
  it('a backflip that runs out of air says so', () => {
    const s = bikeAt('enduro', 'kick', KICK_X - 15, 7);
    T.cruise = 7;
    let swiped = false;
    const evs: LabEvents[] = [];
    for (let n = 0; n < 400; n++) {
      const swipe = !s.grounded && !swiped ? 'down' : null;
      if (swipe) swiped = true;
      const ev = stepLab(s, intent({ swipe }), DT, phys, [LIP]);
      evs.push(ev);
      if (swiped && s.grounded) break;
    }
    const short = evs.find((e) => e.short);
    expect(short?.short).toBe('flip');
    expect(short?.shortPopped).toBe(false);
  });
});

describe('the trick speed boost', () => {
  // ride at the kicker, swipe a trick once in the air, then keep riding after the landing
  function jump(id: LabBikeId, swipe: 'up' | 'down' | null, boost: number, speed = 7) {
    const s = bikeAt(id, 'kick', KICK_X - 15, speed);
    T.cruise = speed;
    T.trickBoost = boost;
    let swiped = false, landed: string | undefined;
    for (let n = 0; n < 600 && !landed; n++) {
      const sw = swipe && !s.grounded && !swiped && (swiped = true) ? swipe : null;
      landed = stepLab(s, intent({ swipe: sw }), DT, phys, [LIP]).landed;
    }
    s.speed = speed; // back at cruising speed on the flat, so only the burst differs
    const speeds: number[] = [s.speed];
    ride(s, {}, 2, (_, st) => speeds.push(st.speed));
    return { s, landed, speedAt: (sec: number) => speeds[Math.round(sec / DT)] };
  }

  it('a clean landing with a trick gives a short burst of speed', () => {
    const a = jump('dirtjumper', 'down', 3, 10), b = jump('dirtjumper', null, 3, 10);
    expect(a.landed).toBe('clean');
    expect(b.landed).toBe('clean');
    expect(a.speedAt(0.3) - b.speedAt(0.3)).toBeGreaterThanOrEqual(1);
    const later = T.trickBoostTime + 0.5;
    expect(Math.abs(a.speedAt(later) - b.speedAt(later))).toBeLessThan(0.3);
  });

  it('the boost can carry you past sprint speed', () => {
    const peakAfter = (boost: number) => {
      const s = bikeAt('dirtjumper', 'kick', KICK_X - 15, 10);
      T.cruise = 10;
      T.trickBoost = boost;
      let swiped = false, landed = false, peak = 0;
      for (let n = 0; n < 600; n++) {
        const swipe = !s.grounded && !swiped ? 'down' : null;
        if (swipe) swiped = true;
        if (stepLab(s, intent({ swipe, throttle: 1 }), DT, phys, [LIP]).landed && !landed) {
          landed = true;
          s.speed = T.sprint; // flat ground, already at sprint
        }
        if (landed) peak = Math.max(peak, s.speed);
      }
      return peak;
    };
    expect(peakAfter(0)).toBeLessThanOrEqual(T.sprint + 0.01);
    expect(peakAfter(3)).toBeGreaterThan(T.sprint + 1);
  });

  it('trickBoost 0 changes nothing', () => {
    expect(DEFAULTS.trickBoost).toBe(0);
    const a = jump('dirtjumper', 'down', 0, 10), b = jump('dirtjumper', null, 0, 10);
    expect(a.s.boost).toBe(0);
    expect(a.speedAt(0.3)).toBeCloseTo(b.speedAt(0.3), 6); // a trick alone adds no speed
  });

  it('a bobble or crash gives no boost', () => {
    // an unfinished no-hander (the enduro spins slowly) bobbles
    const bobble = jump('enduro', 'up', 3);
    expect(bobble.landed).toBe('bobble');
    expect(bobble.s.boost).toBe(0);
    // a finished trick, then a fall onto a nose-down bike: a wipeout
    const s = bikeAt('dirtjumper', 'flat', 10, 7);
    T.trickBoost = 3;
    s.grounded = false;
    s.autoLand = false;
    s.pos.y = 2;
    s.vy = 0;
    let landed: string | undefined, boosted = false;
    for (let n = 0; n < 200 && !landed; n++) {
      s.pitch = 1.3;
      landed = stepLab(s, intent({ swipe: n === 0 ? 'up' : null }), DT, phys, []).landed;
      if (s.boost > 0) boosted = true;
    }
    expect(landed === 'wipeout' || landed === 'big').toBe(true);
    expect(boosted).toBe(false);
  });

  it('a trick at top speed never leaves the bike slower than no trick', () => {
    // flat ground with the speed limit at the bike's speed: the push has nowhere to go
    const run = (boosted: boolean) => {
      const s = bikeAt('dirtjumper', 'flat', 10, 10);
      T.maxSpeed = 10;
      T.cruise = 10;
      T.trickBoost = 3;
      s.speed = 10;
      if (boosted) { s.boost = T.trickBoostTime; s.boostPush = 3; s.boostGain = 0; }
      const speeds: number[] = [];
      ride(s, { throttle: 1 }, 2, (_, st) => speeds.push(st.speed));
      return speeds;
    };
    const a = run(true), b = run(false);
    for (let n = 0; n < a.length; n++) expect(a[n]).toBeGreaterThanOrEqual(b[n] - 0.05);
  });

  it('a wall or rock hit during the burst never leaves the bike slower than no trick', () => {
    // the burst is on as the bike meets the rock bar (a scrape that keeps part of the speed) or the V (a stop)
    const run = (boosted: boolean, x: number, secs: number) => {
      const s = bikeAt('bolinas', 'graze', x, 5);
      T.cruise = 5;
      T.trickBoost = 3;
      T.trickBoostTime = 2; // long enough to still be on when the rock is met
      if (boosted) { s.boost = T.trickBoostTime; s.boostPush = 3; s.boostGain = 0; }
      let touched = false, stuckGain = 0;
      ride(s, {}, secs, (ev, st) => {
        if (ev.scrape || ev.bump || ev.wallStop || ev.plow) touched = true;
        if (touched && st.speed === 0) stuckGain = Math.max(stuckGain, st.boostGain); // a full stop owes nothing
      });
      return { s, touched, stuckGain };
    };
    // the bar: the burst is still on when it is met
    const sa = run(true, 36, 6), sb = run(false, 36, 6);
    expect(sb.touched).toBe(true);
    expect(sa.s.speed).toBeGreaterThanOrEqual(sb.s.speed - 0.05);
    // the V: both stop dead, and the burst leaves nothing to eat into pedaling afterwards
    const va = run(true, 66, 5), vb = run(false, 66, 5);
    expect(vb.s.speed).toBeLessThan(0.5);
    expect(va.s.speed).toBeLessThan(0.5);
    expect(va.stuckGain).toBe(0);
    expect(va.s.boostGain).toBe(0);
  });
});


describe('points come from lines over features', () => {
  it('flat hops and the tricks in their air score nothing', () => {
    const s = bikeAt('dirtjumper', 'flat', 10, 3);
    let hops = 0, tricks = 0;
    for (let n = 0; n < 6 / DT; n++) {
      const swipe = !s.grounded && s.air && s.air.t > 0.05 && !s.trick ? ('up' as const) : null;
      const ev = stepLab(s, intent({ hop: s.grounded ? 0.05 : null, swipe }), DT, phys, []);
      if (ev.trick === 'bunnyhop') hops++;
      if (ev.trick === 'nohander') tricks++;
      expect(s.combo.count).toBe(0);
    }
    expect(hops).toBeGreaterThanOrEqual(3);
    expect(tricks).toBeGreaterThanOrEqual(3);
    expect(s.score).toBe(0);
  });

  it('a manual on the flat with no line scores nothing', () => {
    const s = bikeAt('dirtjumper', 'flat', 10, 3);
    stepLab(s, intent({ swipe: 'down' }), DT, phys, []);
    expect(s.manual).toBeGreaterThan(0); // still a manual to ride
    ride(s, {}, 4);
    expect(s.combo).toEqual({ points: 0, count: 0 });
    expect(s.score).toBe(0);
  });

  // roll the kicker (no pop) and do one no-hander in the air; then, if asked, manual on landing
  function offTheKick(manual: boolean) {
    const s = bikeAt('dirtjumper', 'kick', KICK_X - 15, 7);
    T.cruise = 7;
    let flew = false, landed = false, landedCount = -1, afterManual = -1, banked = 0;
    for (let n = 0; n < 8 / DT; n++) {
      const air = !s.grounded && s.air && s.air.t > 0.05 && !s.trick && !flew;
      const swipe = air ? ('up' as const) : manual && landed && s.grounded && afterManual < 0 ? ('down' as const) : null;
      const ev = stepLab(s, intent({ swipe }), DT, phys, [LIP]);
      if (ev.trick === 'nohander') flew = true;
      if (swipe === 'down') afterManual = s.combo.count;
      if (ev.landed && flew && !landed) { landed = true; landedCount = s.combo.count; }
      if (ev.banked) banked += ev.banked;
    }
    return { s, flew, landedCount, afterManual, banked };
  }

  it('a trick off a lip counts and banks after landing', () => {
    const r = offTheKick(false);
    expect(r.flew).toBe(true);
    expect(r.landedCount).toBe(1);
    expect(r.banked).toBe(TRICK_INFO.nohander.points);
    expect(r.s.score).toBe(TRICK_INFO.nohander.points);
  });

  it('a manual after landing joins the line', () => {
    const r = offTheKick(true);
    expect(r.afterManual).toBe(2);
    expect(r.banked).toBeGreaterThan(2 * TRICK_INFO.nohander.points);
  });

  it('flat hops inside a manual on a line add nothing: hops score by where they leave from', () => {
    const s = bikeAt('dirtjumper', 'kick', KICK_X - 15, 7);
    T.cruise = 7;
    let flew = false, landed = false, manualed = false, total = 0;
    for (let n = 0; n < 14 / DT; n++) {
      const air = !s.grounded && s.air && s.air.t > 0.05 && !s.trick && !flew;
      const swipe = air ? ('up' as const) : landed && !manualed && s.grounded ? ('down' as const) : null;
      if (swipe === 'down') manualed = true;
      const hop = manualed && s.grounded ? 0.05 : null; // hop every ground step once the manual is going
      const ev = stepLab(s, intent({ swipe, hop }), DT, phys, [LIP]);
      if (ev.trick === 'nohander') flew = true;
      if (ev.landed && flew) landed = true;
      if (ev.banked) total += ev.banked;
    }
    expect(manualed).toBe(true);
    // the no-hander and the manual, x2: (200 + up to 180) x 2. It was 77,000 when flat hops grew the line
    expect(total + s.combo.points * Math.max(1, s.combo.count)).toBeLessThanOrEqual(2 * (TRICK_INFO.nohander.points + 3 * TRICK_INFO.manual.points));
  });

  it('a manual on the plank or a kicker opens a line', () => {
    const s = bikeAt('dirtjumper', 'kick', KICK_X - 4, 3);
    for (let n = 0; n < 200 && !(s.grounded && s.surface === 'ramp'); n++) stepLab(s, intent(), DT, phys, [LIP]);
    expect(s.surface).toBe('ramp');
    stepLab(s, intent({ swipe: 'down' }), DT, phys, [LIP]);
    expect(s.combo.count).toBe(1);
  });

  // dropped square onto the flat at vy, rolling at 3 m/s: the touchdown's events and the speed either side of it
  function drop(id: LabBikeId, vy: number) {
    const s = bikeAt(id, 'flat', 10, 3);
    Object.assign(s, { grounded: false, vy, pitch: 0 });
    s.pos.y += 0.03;
    let before = s.speed, ev: LabEvents | undefined;
    for (let n = 0; n < 30 && !ev; n++) {
      before = s.speed;
      const e = stepLab(s, intent(), DT, phys, []);
      if (e.landed) ev = e;
    }
    return { ev: ev!, kept: s.speed / before, s };
  }

  it('a landing too hard for a rigid bike bottoms out and costs its flatKeep', () => {
    const soft = drop('hardtail', -4), hard = drop('hardtail', -8);
    expect(soft.ev.bottomed).toBe(false);
    expect(soft.ev.used!).toBeLessThan(1);
    expect(hard.ev.bottomed).toBe(true);
    expect(hard.ev.used!).toBeCloseTo(hard.ev.impact! / 6, 5);
    expect(hard.ev.landed).toBe('clean');
    expect(hard.kept).toBeLessThan(soft.kept - 0.05);
  });

  it('the enduro soaks the same landing up', () => {
    const en = drop('enduro', -8);
    expect(en.ev.bottomed).toBe(false);
    expect(en.ev.used!).toBeLessThan(1);
  });

  it('a landing well past bottoming slams into a bobble', () => {
    const vy = -6 * (1 + DEFAULTS.bottomMargin) - 1;
    const r = drop('hardtail', vy);
    expect(r.ev.impact!).toBeGreaterThan(6 * (1 + DEFAULTS.bottomMargin));
    expect(r.ev.landed).toBe('bobble');
  });
});
