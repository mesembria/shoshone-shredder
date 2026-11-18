export type Outcome = 'clean' | 'bobble' | 'wipeout' | 'big';

export interface Landing {
  angleErrorDeg: number; // bike pitch versus the ground
  fallHeight: number; // meters from the top of the jump to the landing
  impactSpeed: number; // downward m/s at touchdown
  trickUnfinished: boolean;
  autoLand: boolean;
}

export const CRASH = {
  cleanDeg: 25, bobbleDeg: 40, assistDeg: 15, unfinishedDeg: 30,
  bigFall: 3, bigImpact: 9,
  // Wall hits count only the speed straight into the wall, so brushing past something is never a crash.
  wallWipeout: 7.5, wallBig: 9, bonkMin: 3.5, headOn: 0.35, scrapeKeep: 0.92, bonkKeep: 0.5,
  starsSeconds: 4, windedSeconds: 3, windedPedal: 0.4, bobbleSpeedKeep: 0.85, getUpSeconds: 2,
};

// Auto-land widens the windows, but landing mid-trick is never clean.
export function classifyLanding(l: Landing): Outcome {
  const assist = l.autoLand ? CRASH.assistDeg : 0;
  const err = l.angleErrorDeg + (l.trickUnfinished ? CRASH.unfinishedDeg : 0);
  if (err <= CRASH.cleanDeg + assist && !l.trickUnfinished) return 'clean';
  if (err <= CRASH.bobbleDeg + assist) return 'bobble';
  return l.fallHeight > CRASH.bigFall || l.impactSpeed > CRASH.bigImpact ? 'big' : 'wipeout';
}

// into: the part of the speed that goes straight into the wall, m/s.
export function classifyWallHit(into: number): Outcome | 'bump' {
  if (into > CRASH.wallBig) return 'big';
  if (into > CRASH.wallWipeout) return 'wipeout';
  return 'bump';
}

export interface WallResponse { outcome: Outcome | 'bump' | 'scrape'; speed: number; slide: boolean }

// cosIn: 1 when riding straight at the wall, 0 when riding along it. A fast head-on hit crashes; anything
// less bonks (a thump and lost speed) or scrapes (sliding along the wall, keeping most of the speed).
export function wallResponse(speed: number, cosIn: number): WallResponse {
  const c = Math.max(0, Math.min(1, cosIn));
  const into = speed * c, along = speed * Math.sqrt(1 - c * c);
  const hit = classifyWallHit(into);
  if (hit !== 'bump') return { outcome: hit, speed, slide: false };
  const slide = along > speed * CRASH.headOn;
  const outcome = into > CRASH.bonkMin ? 'bump' : 'scrape';
  return { outcome, speed: slide ? along * (outcome === 'bump' ? CRASH.bonkKeep : CRASH.scrapeKeep) : 0, slide };
}

export interface Penalties { stars: number; winded: number }

// Big crashes bring Seeing stars and Winded. Yard Sale joins in Phase 1, with Bolts.
export function penaltiesFor(o: Outcome | 'bump'): Penalties {
  return o === 'big' ? { stars: CRASH.starsSeconds, winded: CRASH.windedSeconds } : { stars: 0, winded: 0 };
}

// Seeing stars: steering drifts while stars remain, fading over the last 1.5 seconds.
export function wobbleSteer(steer: number, time: number, stars: number): number {
  if (stars <= 0) return steer;
  const strength = 0.35 * Math.min(1, stars / 1.5);
  return Math.max(-1, Math.min(1, steer + strength * Math.sin(time * 7.3)));
}

export function pedalPower(winded: number): number {
  return winded > 0 ? CRASH.windedPedal : 1;
}
