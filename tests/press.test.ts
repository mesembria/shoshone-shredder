import { describe, it, expect } from 'vitest';
import { createPresses } from '../src/input/press';

// buttons stand in as strings; pointer 1 is the thumb on the stick, which never lands on a button
describe('createPresses', () => {
  it('a touch that lifts on the button it came down on presses it', () => {
    const p = createPresses<string>();
    p.down(2, 'map');
    expect(p.up(2, 'map', 100)).toBe('map');
  });

  it('presses with a thumb still down elsewhere', () => {
    const p = createPresses<string>();
    p.down(1, null); // the stick
    p.down(2, 'area');
    expect(p.up(2, 'area', 100)).toBe('area');
    expect(p.up(1, null, 200)).toBeNull();
  });

  it('lifting off the button, or on another one, presses nothing', () => {
    const p = createPresses<string>();
    p.down(2, 'map');
    expect(p.up(2, null, 100)).toBeNull();
    p.down(3, 'map');
    expect(p.up(3, 'area', 200)).toBeNull();
  });

  it('a finger the browser cancels (a scroll in the list) presses nothing', () => {
    const p = createPresses<string>();
    p.down(2, 'go');
    p.cancel(2);
    expect(p.up(2, 'go', 100)).toBeNull();
  });

  it('each finger presses once', () => {
    const p = createPresses<string>();
    p.down(2, 'swap');
    expect(p.up(2, 'swap', 100)).toBe('swap');
    expect(p.up(2, 'swap', 110)).toBeNull();
  });

  it('ignores the click a lone tap makes after its press, wherever it lands', () => {
    const p = createPresses<string>();
    p.down(2, 'area');
    p.up(2, 'area', 1000);
    expect(p.click('area', 1050)).toBeNull();
    expect(p.click('go', 1300)).toBeNull(); // the sheet the tap opened, under the finger
  });

  it('a mouse click or a key presses through click', () => {
    const p = createPresses<string>();
    expect(p.click('map', 100)).toBe('map');
    p.down(2, 'area');
    p.up(2, 'area', 1000);
    expect(p.click('map', 3000)).toBe('map'); // long after a touch press
    expect(p.click(null, 3100)).toBeNull(); // not on a button
  });
});
