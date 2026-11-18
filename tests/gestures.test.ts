import { describe, it, expect } from 'vitest';
import { classifyRelease } from '../src/rules/gestures';

describe('classifyRelease', () => {
  it('a quick small touch is a tap', () => expect(classifyRelease(90, 3, 2)).toEqual({ kind: 'tap' }));
  it('a long still touch is a hold', () => expect(classifyRelease(400, 4, 1)).toEqual({ kind: 'hold', seconds: 0.4 }));
  it('a fast flick right is a right swipe', () => expect(classifyRelease(120, 80, 10)).toEqual({ kind: 'swipe', dir: 'right' }));
  it('a fast flick up is an up swipe', () => expect(classifyRelease(150, 5, -60)).toEqual({ kind: 'swipe', dir: 'up' }));
  it('a slow drag is a hold, not a swipe', () => expect(classifyRelease(600, 80, 0)).toEqual({ kind: 'hold', seconds: 0.6 }));
});
