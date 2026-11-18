// Touch and keyboard become one Intent. The pad is plain logic; bindPad wires it to the page.
import type { Intent } from '../bike/controller';
import { classifyRelease, GESTURE, type SwipeDir } from '../rules/gestures';

export const STICK = { range: 70, dead: 8 }; // px of thumb travel for full steer or throttle

// Left thumb: drag sideways to steer, up to pedal harder, down to brake. dy grows downward.
export function stick(dx: number, dy: number): { steer: number; throttle: number } {
  const axis = (v: number) =>
    Math.abs(v) <= STICK.dead ? 0 : Math.max(-1, Math.min(1, (v - Math.sign(v) * STICK.dead) / (STICK.range - STICK.dead)));
  return { steer: axis(dx), throttle: axis(-dy) };
}

export interface Thumb { x0: number; y0: number; x: number; y: number }

// A new left touch takes the stick from the held thumb only when it lands on the stick (within half its reach
// again). That still rescues a thumb whose lift iPadOS swallowed, while a palm or the base of the thumb brushing
// the corner as the thumb stretches to steer can't grab the stick and yank it down-left.
export function takesOverStick(stickAt: { x: number; y: number }, touch: { x: number; y: number }, range: number): boolean {
  return Math.hypot(touch.x - stickAt.x, touch.y - stickAt.y) <= range * 1.5;
}
export interface Pad {
  down(id: number, x: number, y: number, t: number): void;
  move(id: number, x: number, y: number): void;
  up(id: number, x: number, y: number, t: number): void;
  cancel(id: number): void;
  key(code: string, pressed: boolean, t: number): boolean; // true when the key is one of ours
  again(): void;
  read(): Intent; // hop, swipe and again fire once, then clear
  crouching(t: number): boolean;
  thumbs(): { left: Thumb | null; right: Thumb | null };
}

// Keyboard, for testing on a laptop: arrows or WASD ride, Space hops (hold for more), J L I K are swipes, R is Again.
const KEYS: Record<string, SwipeDir> = { KeyJ: 'left', KeyL: 'right', KeyI: 'up', KeyK: 'down' };
const STEER_LEFT = ['ArrowLeft', 'KeyA'], STEER_RIGHT = ['ArrowRight', 'KeyD'], PUSH = ['ArrowUp', 'KeyW'], BRAKE = ['ArrowDown', 'KeyS'];
const RIDE_KEYS = [...STEER_LEFT, ...STEER_RIGHT, ...PUSH, ...BRAKE];
export const isPadKey = (code: string) => code === 'Space' || code === 'KeyR' || code in KEYS || RIDE_KEYS.includes(code);

export function createPad(width: () => number): Pad {
  let left: (Thumb & { id: number }) | null = null;
  let right: (Thumb & { id: number; t0: number }) | null = null;
  const held = new Set<string>();
  let spaceAt: number | null = null;
  let hop: number | null = null, swipe: SwipeDir | null = null, again = false;
  const any = (codes: string[]) => codes.some((c) => held.has(c));

  return {
    down(id, x, y, t) {
      if (x < width() / 2) {
        if (!left) left = { id, x0: x, y0: y, x, y };
      } else if (!right) right = { id, x0: x, y0: y, x, y, t0: t };
    },
    move(id, x, y) {
      if (left?.id === id) Object.assign(left, { x, y });
      if (right?.id === id) Object.assign(right, { x, y });
    },
    up(id, x, y, t) {
      if (left?.id === id) left = null;
      if (right?.id === id) {
        const g = classifyRelease(t - right.t0, x - right.x0, y - right.y0);
        if (g.kind === 'swipe') swipe = g.dir;
        else hop = g.kind === 'tap' ? 0 : g.seconds;
        right = null;
      }
    },
    cancel(id) {
      if (left?.id === id) left = null;
      if (right?.id === id) right = null;
    },
    key(code, pressed, t) {
      if (code === 'Space') {
        if (pressed) spaceAt = t;
        else if (spaceAt !== null) {
          hop = (t - spaceAt) / 1000;
          spaceAt = null;
        }
        return true;
      }
      if (KEYS[code]) {
        if (pressed) swipe = KEYS[code];
        return true;
      }
      if (code === 'KeyR') {
        if (pressed) again = true;
        return true;
      }
      if (RIDE_KEYS.includes(code)) {
        if (pressed) held.add(code);
        else held.delete(code);
        return true;
      }
      return false;
    },
    again() {
      again = true;
    },
    read() {
      const fromThumb = left ? stick(left.x - left.x0, left.y - left.y0) : null;
      const intent: Intent = {
        steer: fromThumb ? fromThumb.steer : (any(STEER_RIGHT) ? 1 : 0) - (any(STEER_LEFT) ? 1 : 0),
        throttle: fromThumb ? fromThumb.throttle : (any(PUSH) ? 1 : 0) - (any(BRAKE) ? 1 : 0),
        hop,
        swipe,
        again,
      };
      hop = null;
      swipe = null;
      again = false;
      return intent;
    },
    crouching(t) {
      return (right !== null && t - right.t0 > GESTURE.tapMaxMs) || spaceAt !== null;
    },
    thumbs() {
      return { left, right };
    },
  };
}

// iPad Safari: pointer events carry each finger; preventDefault stops scrolling, zoom and the long-press menu.
export function bindPad(el: HTMLElement, pad: Pad): () => void {
  const now = () => performance.now();
  const down = (e: PointerEvent) => {
    e.preventDefault();
    pad.down(e.pointerId, e.clientX, e.clientY, now());
  };
  const move = (e: PointerEvent) => pad.move(e.pointerId, e.clientX, e.clientY);
  const up = (e: PointerEvent) => pad.up(e.pointerId, e.clientX, e.clientY, now());
  const cancel = (e: PointerEvent) => pad.cancel(e.pointerId);
  // Held keys repeat; a repeat would restart the Space hold, so repeats only block the page from scrolling.
  const key = (pressed: boolean) => (e: KeyboardEvent) => {
    if (!isPadKey(e.code)) return;
    e.preventDefault();
    if (!e.repeat) pad.key(e.code, pressed, now());
  };
  const keyDown = key(true), keyUp = key(false);
  const noMenu = (e: Event) => e.preventDefault();
  el.addEventListener('pointerdown', down, { passive: false });
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  el.addEventListener('contextmenu', noMenu);
  return () => {
    el.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    el.removeEventListener('contextmenu', noMenu);
  };
}
