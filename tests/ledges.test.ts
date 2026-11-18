import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ledgeGate, ledgeAhead, type Ledge } from '../src/world/trail';
import { runEvent } from '../src/game/spots';

// a ledge ridden toward -x
const L: Ledge = { pos: new THREE.Vector3(10, 0.3, 5), yaw: Math.PI, half: 1.5 };
const where = (x: number, z: number) => ({ x, y: 0.3, z, grounded: true });

describe('ledges on any heading', () => {
  it('the gate counts crossing in the riding direction only', () => {
    const runs = { l: { start: ledgeGate(L), finish: ledgeGate(L) } };
    expect(runEvent('l', where(10.4, 5), where(9.6, 5), runs)).toBe('start');
    expect(runEvent('l', where(9.6, 5), where(10.4, 5), runs)).toBe(null);
  });
  it('says how far ahead it is, or Infinity when facing away or beside it', () => {
    expect(ledgeAhead(L, 14, 5, Math.PI)).toBeCloseTo(4, 5);
    expect(ledgeAhead(L, 14, 5, 0)).toBe(Infinity);
    expect(ledgeAhead(L, 14, 7.5, Math.PI)).toBe(Infinity);
  });
});
