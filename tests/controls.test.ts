import { describe, it, expect } from 'vitest';
import { createPad, stick, isPadKey } from '../src/input/controls';

const W = 1000; // screen width: the left half steers, the right half hops and tricks
const pad = () => createPad(() => W);

describe('stick', () => {
  it('ignores tiny drags and tops out at full travel', () => {
    expect(stick(5, -5)).toEqual({ steer: 0, throttle: 0 });
    expect(stick(70, 0).steer).toBe(1);
    expect(stick(-200, 0).steer).toBe(-1);
    expect(stick(0, -70).throttle).toBe(1); // thumb up pedals harder
    expect(stick(0, 70).throttle).toBe(-1); // thumb down brakes
  });
});

describe('createPad', () => {
  it('left thumb steers until it lifts', () => {
    const p = pad();
    p.down(1, 200, 600, 0);
    p.move(1, 270, 600);
    expect(p.read().steer).toBe(1);
    p.up(1, 270, 600, 500);
    expect(p.read().steer).toBe(0);
  });

  it('right tap hops once', () => {
    const p = pad();
    p.down(2, 800, 600, 0);
    p.up(2, 802, 601, 100);
    expect(p.read().hop).toBe(0);
    expect(p.read().hop).toBeNull();
  });

  it('right hold hops higher and crouches while held', () => {
    const p = pad();
    p.down(2, 800, 600, 0);
    expect(p.crouching(100)).toBe(false);
    expect(p.crouching(250)).toBe(true);
    p.up(2, 800, 600, 300);
    expect(p.read().hop).toBeCloseTo(0.3);
  });

  it('right swipe is a trick, not a hop', () => {
    const p = pad();
    p.down(2, 800, 600, 0);
    p.up(2, 800, 520, 150);
    const i = p.read();
    expect(i.swipe).toBe('up');
    expect(i.hop).toBeNull();
  });

  it('both thumbs work at once', () => {
    const p = pad();
    p.down(1, 200, 600, 0);
    p.move(1, 130, 600);
    p.down(2, 800, 600, 10);
    p.up(2, 800, 600, 60);
    const i = p.read();
    expect(i.steer).toBe(-1);
    expect(i.hop).toBe(0);
  });

  it('keyboard rides, hops, tricks and taps Again', () => {
    const p = pad();
    p.key('ArrowLeft', true, 0);
    p.key('ArrowUp', true, 0);
    p.key('Space', true, 0);
    p.key('Space', false, 200);
    p.key('KeyI', true, 210);
    p.key('KeyR', true, 220);
    const i = p.read();
    expect(i).toMatchObject({ steer: -1, throttle: 1, swipe: 'up', again: true });
    expect(i.hop).toBeCloseTo(0.2);
    expect(isPadKey('KeyQ')).toBe(false);
  });
});
