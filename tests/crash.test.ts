import { describe, it, expect } from 'vitest';
import { classifyLanding, classifyWallHit, wallResponse, penaltiesFor, wobbleSteer, pedalPower, type Landing } from '../src/rules/crash';

const land = (o: Partial<Landing>): Landing => ({ angleErrorDeg: 0, fallHeight: 1, impactSpeed: 4, trickUnfinished: false, autoLand: false, ...o });

describe('classifyLanding', () => {
  it('a level landing is clean', () => expect(classifyLanding(land({ angleErrorDeg: 10 }))).toBe('clean'));
  it('auto-land widens the clean window', () => {
    expect(classifyLanding(land({ angleErrorDeg: 35, autoLand: true }))).toBe('clean');
    expect(classifyLanding(land({ angleErrorDeg: 35, autoLand: false }))).toBe('bobble');
  });
  it('a bad angle from low down is a wipeout', () => expect(classifyLanding(land({ angleErrorDeg: 60, fallHeight: 1.5, impactSpeed: 5 }))).toBe('wipeout'));
  it('a bad angle from high up is a big crash', () => expect(classifyLanding(land({ angleErrorDeg: 60, fallHeight: 4 }))).toBe('big'));
  it('a bad angle at high impact speed is a big crash', () => expect(classifyLanding(land({ angleErrorDeg: 60, fallHeight: 2, impactSpeed: 10 }))).toBe('big'));
  it('an unfinished trick turns a level landing into a bobble', () => expect(classifyLanding(land({ angleErrorDeg: 5, trickUnfinished: true }))).toBe('bobble'));
  it('auto-land never makes an unfinished trick clean', () => {
    expect(classifyLanding(land({ angleErrorDeg: 0, trickUnfinished: true, autoLand: true }))).toBe('bobble');
    expect(classifyLanding(land({ angleErrorDeg: 30, trickUnfinished: true, autoLand: true }))).toBe('wipeout');
  });
});

describe('classifyWallHit', () => {
  it('cruising straight into a wall is a bump', () => expect(classifyWallHit(7)).toBe('bump'));
  it('pushing hard straight into a wall is a wipeout', () => expect(classifyWallHit(8)).toBe('wipeout'));
  it('top speed straight into a wall is a big crash', () => expect(classifyWallHit(9.5)).toBe('big'));
});

describe('wallResponse', () => {
  it('a glancing hit at top speed scrapes along and keeps most of the speed', () => {
    const r = wallResponse(10.5, Math.sin(0.25)); // 14 degrees off the wall
    expect(r.outcome).toBe('scrape');
    expect(r.slide).toBe(true);
    expect(r.speed).toBeGreaterThan(9);
  });
  it('a medium hit bonks and slows', () => {
    const r = wallResponse(7, Math.cos(1));
    expect(r.outcome).toBe('bump');
    expect(r.speed).toBeLessThan(4);
  });
  it('head-on at cruise stops without a crash', () => expect(wallResponse(7, 1)).toEqual({ outcome: 'bump', speed: 0, slide: false }));
  it('head-on at top speed crashes and keeps its speed for the tumble', () => expect(wallResponse(10.5, 1)).toEqual({ outcome: 'big', speed: 10.5, slide: false }));
});

describe('penalties', () => {
  it('big crashes bring stars and wind', () => expect(penaltiesFor('big')).toEqual({ stars: 4, winded: 3 }));
  it('wipeouts bring neither', () => expect(penaltiesFor('wipeout')).toEqual({ stars: 0, winded: 0 }));
  it('steering is untouched without stars', () => expect(wobbleSteer(0.5, 1.23, 0)).toBe(0.5));
  it('steering with stars stays between -1 and 1', () => {
    for (let t = 0; t < 10; t += 0.07) {
      const v = wobbleSteer(1, t, 4);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(-1);
    }
  });
  it('winded riders pedal at 40 percent', () => {
    expect(pedalPower(1)).toBe(0.4);
    expect(pedalPower(0)).toBe(1);
  });
});
