// Feel lab: controls you can see. A stick resting on the left, a yellow Jump button and a red Brake button on the
// right, so a kid picking up the iPad knows where the thumbs go. Touching anywhere on the left still grabs the
// stick and anywhere on the right still jumps; the drawn controls show where to start. Trick swipes show round
// the Jump button. Everything pulses until the first touch.
import { takesOverStick, type Pad, type Thumb } from '../input/controls';
import { GESTURE } from '../rules/gestures';
import { T } from './tune';

export interface Controls {
  braking(): boolean;
  releaseBrake(keep: number | null): void;
  update(left: Thumb | null, right: Thumb | null, now: number, st: { inAir: boolean; pumping: boolean; downhill: boolean; ledge?: false | 'ledge' | 'log'; loose?: boolean; energy?: number; burnt?: boolean }): void;
  setAirHints(h: { above: string; below: string }): void; // the game lists only the tricks a rider has
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Where the stick rests on the left. With stickFixed on (the boys asked: a stick that wanders makes tricks harder)
// it never leaves here: a left thumb steers by how far it is from this spot, wherever it landed.
export const stickHome = () => ({ x: 130, y: window.innerHeight * 0.62 });

// What the right thumb can do right now, shown round the Jump button. Matches the lab bike's trick rules.
const DEFAULT_HINTS = {
  air: { above: 'swipe ↑ No-hander', below: '↓ Backflip · ←→ 360\nhold: Tabletop' },
  ground: { above: '', below: 'swipe ↓ Manual' },
  downhill: { above: 'hold to Pump', below: 'swipe ↓ Manual' },
  ledge: { above: 'tap to hop the ledge!', below: '' },
  log: { above: 'tap to hop the log!', below: '' },
};

export function createControls(root: HTMLElement): Controls {
  const box = document.createElement('div');
  box.className = 'ctl';
  box.innerHTML = `
    <div class="stick hint"><i class="zone"></i><i class="fuel"></i><i class="knob"></i><span class="ar l">◀</span><span class="ar r">▶</span><span class="word up">faster</span><span class="word down">slower</span></div>
    <div class="jumpbtn hint"><i class="fill"></i><i class="face"><b>JUMP</b></i><span class="tricks above"></span><span class="tricks below"></span></div>
    <button class="brakebtn hint" aria-label="Brake"><i class="face"><b>BRAKE</b></i></button>`;
  root.append(box);
  const stick = box.querySelector<HTMLElement>('.stick')!, knob = stick.querySelector<HTMLElement>('.knob')!;
  const fuel = stick.querySelector<HTMLElement>('.fuel')!;
  let fuelShown = -1;
  const zone = stick.querySelector<HTMLElement>('.zone')!, faster = stick.querySelector<HTMLElement>('.word.up')!;
  const jump = box.querySelector<HTMLElement>('.jumpbtn')!, brake = box.querySelector<HTMLElement>('.brakebtn')!;
  const above = jump.querySelector<HTMLElement>('.above')!, below = jump.querySelector<HTMLElement>('.below')!;
  const word = jump.querySelector<HTMLElement>('.face b')!;
  const HINTS = { ...DEFAULT_HINTS };

  // the first touch anywhere stops the pulsing
  const settle = () => {
    for (const el of [stick, jump, brake]) el.classList.remove('hint');
    window.removeEventListener('pointerdown', settle);
  };
  window.addEventListener('pointerdown', settle);

  // Brake is a real button: its touch never reaches the canvas, so it isn't taken for a jump. It stays on until
  // that finger lifts, even if the thumb slides off it.
  let brakeId: number | null = null;
  brake.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    brakeId = e.pointerId; // the newest finger on it, in case an old one's lift never arrived
    brake.classList.add('on');
  }, { passive: false });
  const lift = (e: PointerEvent) => {
    if (e.pointerId !== brakeId) return;
    brakeId = null;
    brake.classList.remove('on');
  };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);
  brake.addEventListener('contextmenu', (e) => e.preventDefault());

  const at = (el: HTMLElement, x: number, y: number) => (el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`);
  let mode = '';
  return {
    braking: () => brakeId !== null,
    setAirHints(h) {
      HINTS.air = h;
      mode = ''; // redraw
    },
    releaseBrake(keep) {
      if (brakeId === null || brakeId === keep) return;
      brakeId = null;
      brake.classList.remove('on');
    },
    update(left, right, now, st) {
      const W = window.innerWidth, H = window.innerHeight, row = H * 0.62;
      // stick: rests at the left edge; unless it's fixed there, it jumps to wherever the thumb lands
      const home = stickHome();
      if (left) {
        const o = T.stickFixed ? home : { x: left.x0, y: left.y0 };
        at(stick, o.x, o.y);
        const dx = left.x - o.x, dy = left.y - o.y, d = Math.hypot(dx, dy), k = d > T.stickRange ? T.stickRange / d : 1;
        knob.style.transform = `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
      } else {
        at(stick, home.x, home.y);
        knob.style.transform = '';
      }
      stick.classList.toggle('on', left !== null);
      // energy: an arc over the top of the stick (clear of a big thumb on the knob) that empties, yellow then red, flashing
      // when you're burnt. --e stays "360deg = a full tank"; the arc draws it into its 140°
      const e = Math.round((st.energy ?? 1) * 100) / 100;
      if (e !== fuelShown) {
        fuelShown = e;
        fuel.style.setProperty('--e', `${(e * 360).toFixed(0)}deg`);
        fuel.classList.toggle('low', e < 0.35);
      }
      fuel.classList.toggle('burnt', !!st.burnt);
      // on gravel: the band of stick that climbs without spinning the back wheel (the knob's middle in it)
      if (stick.classList.toggle('loose', !!st.loose)) {
        const px = (t: number) => 6 + t * (T.stickRange - 6);
        zone.style.top = `calc(50% - ${px(T.looseLimit).toFixed(0)}px)`;
        zone.style.height = `${(px(T.looseLimit) - px(T.looseMin)).toFixed(0)}px`;
      }
      faster.textContent = st.loose ? 'a little push' : 'faster';
      // jump: fills while held, the same curve that makes a longer hold hop higher
      at(jump, W - 130, row);
      const held = right ? (now - ((right as Thumb & { t0?: number }).t0 ?? now)) / 1000 : 0;
      jump.classList.toggle('on', right !== null);
      jump.style.setProperty('--c', String(right && held * 1000 > GESTURE.tapMaxMs ? clamp((held - 0.12) / 0.3, 0, 1) : 0));
      const m = st.inAir ? 'air' : st.ledge ? st.ledge : st.downhill ? 'downhill' : 'ground';
      if (m !== mode) {
        mode = m;
        above.textContent = HINTS[m].above;
        below.textContent = HINTS[m].below;
        jump.classList.toggle('air', st.inAir);
      }
      // pressing on a downhill: the button goes green and says so
      if (st.pumping !== jump.classList.contains('pump')) {
        jump.classList.toggle('pump', st.pumping);
        word.textContent = st.pumping ? 'PUMP' : 'JUMP';
      }
      at(brake, W - 290, row + 75);
    },
  };
}

// iPadOS can take a touch for itself (Safari's swipe back from the left edge, the Home or Control Center swipes,
// a palm) without ever telling the page it ended. The pad would then hold that thumb forever and ignore new
// ones: the stick sticks until a reload. So a new touch on a side takes over that side (on the left, only if it
// lands on the stick, so a palm brushing the corner while steering can't steal it), and whenever the
// browser's own list of fingers on the screen says nothing else can be down, the leftovers are let go. The
// finger checks wait a moment, so a normal lift is handled first and a release still hops.
export function guardTouches(canvas: HTMLElement, pad: Pad, ctl: Controls): void {
  const idOf = (t: Thumb | null) => (t ? (t as Thumb & { id: number }).id : null);
  let newest: number | null = null;
  const releaseAllBut = (keep: number | null) => {
    const { left, right } = pad.thumbs();
    for (const id of [idOf(left), idOf(right)]) if (id !== null && id !== keep) pad.cancel(id);
    ctl.releaseBrake(keep);
  };
  window.addEventListener('pointerdown', (e) => {
    newest = e.pointerId;
    if (e.target !== canvas) return;
    const { left, right } = pad.thumbs();
    const onLeft = e.clientX < window.innerWidth / 2;
    const old = idOf(onLeft ? left : right);
    if (old === null || old === e.pointerId) return;
    // on the left, only a touch on the stick takes over; a palm in the corner is ignored
    if (onLeft && left) {
      const stickAt = T.stickFixed ? stickHome() : { x: left.x0, y: left.y0 };
      if (!takesOverStick(stickAt, { x: e.clientX, y: e.clientY }, T.stickRange)) return;
    }
    pad.cancel(old);
  }, { capture: true });
  const fingers = (e: TouchEvent) => {
    const n = e.touches.length, started = e.type === 'touchstart';
    setTimeout(() => {
      if (n === 0) releaseAllBut(null);
      else if (n === 1 && started) releaseAllBut(newest); // the finger that just came down is the only one
    }, 60);
  };
  for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) window.addEventListener(type, fingers, { capture: true, passive: true });
  window.addEventListener('blur', () => releaseAllBut(null));
  window.addEventListener('pagehide', () => releaseAllBut(null));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllBut(null);
  });
}
