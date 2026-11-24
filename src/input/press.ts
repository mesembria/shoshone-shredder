// Pressing the ride's buttons. iPad Safari (and Chrome) only turn a tap into a click when no other finger is on the
// glass, and on the ride a thumb is nearly always on the stick (or a palm rests on the edge): a tap on 🗺 Map, 📍,
// Stop or Swap then fired pointerdown and pointerup on the button but never a click, so the buttons did nothing until
// every finger came off. So a touch presses a button when it lifts on the button it came down on, whatever the other
// fingers are doing, the way the stick, Jump and Brake already work. A mouse or a key still presses through click. The
// click a lone tap also makes after its lift is ignored: Safari aims it at whatever is under the finger by then,
// maybe a row on the sheet the tap just opened.

const QUIET_MS = 700; // after a touch press, how long a click is taken for that tap's own

// The rule on its own (B is a button): which touch presses what, and which clicks count.
export function createPresses<B>() {
  const downs = new Map<number, B>(); // each finger that came down on a button, and that button
  let quietUntil = -Infinity;
  return {
    down(pointer: number, button: B | null): void {
      if (button === null) downs.delete(pointer);
      else downs.set(pointer, button);
    },
    // under: the button under the finger as it lifts. Returns the button pressed, or null
    up(pointer: number, under: B | null, now: number): B | null {
      const b = downs.get(pointer);
      downs.delete(pointer);
      if (b === undefined || under !== b) return null;
      quietUntil = now + QUIET_MS;
      return b;
    },
    // the browser took the finger (a scroll in the list, a system swipe): no press
    cancel(pointer: number): void {
      downs.delete(pointer);
    },
    click(button: B | null, now: number): B | null {
      return button !== null && now >= quietUntil ? button : null;
    },
  };
}

// Every button inside root presses through press(button). (A button with its own listeners there gets press too.)
export function bindPresses(root: HTMLElement, press: (button: HTMLButtonElement) => void): void {
  const p = createPresses<HTMLButtonElement>();
  const buttonOf = (t: EventTarget | null): HTMLButtonElement | null => {
    const b = t instanceof Element ? t.closest('button') : null;
    return b && root.contains(b) && !b.disabled ? b : null;
  };
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') p.down(e.pointerId, buttonOf(e.target));
  });
  // a touch's events stay on the button it came down on, even off it: ask what is under the finger as it lifts
  window.addEventListener('pointerup', (e) => {
    const b = p.up(e.pointerId, buttonOf(document.elementFromPoint(e.clientX, e.clientY)), performance.now());
    if (b) press(b);
  });
  window.addEventListener('pointercancel', (e) => p.cancel(e.pointerId));
  root.addEventListener('click', (e) => {
    const b = p.click(buttonOf(e.target), performance.now());
    if (b) press(b);
  });
}
