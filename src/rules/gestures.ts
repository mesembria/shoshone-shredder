export type SwipeDir = 'up' | 'down' | 'left' | 'right';
export type Gesture = { kind: 'tap' } | { kind: 'hold'; seconds: number } | { kind: 'swipe'; dir: SwipeDir };

export const GESTURE = { swipeMinPx: 40, swipeMaxMs: 300, tapMaxMs: 180, tapMaxPx: 12 };

// Classify a right-thumb touch when it lifts. dy grows downward, as on screen.
export function classifyRelease(ms: number, dx: number, dy: number): Gesture {
  const dist = Math.hypot(dx, dy);
  if (dist >= GESTURE.swipeMinPx && ms <= GESTURE.swipeMaxMs) {
    const dir: SwipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down';
    return { kind: 'swipe', dir };
  }
  if (ms <= GESTURE.tapMaxMs && dist <= GESTURE.tapMaxPx) return { kind: 'tap' };
  return { kind: 'hold', seconds: ms / 1000 };
}
