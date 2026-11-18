import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { chaseSpot, CAM } from '../src/view/camera';
import { createBikeState } from '../src/bike/controller';
import { BIKES } from '../src/rules/bikes';

const rider = () => createBikeState(BIKES.bolinas, new THREE.Vector3(0, 0, 0), 0); // faces +x
const open = () => false;

describe('chaseSpot', () => {
  it('sits low behind the rider on open ground', () => {
    const spot = new THREE.Vector3();
    expect(chaseSpot(rider(), open, spot)).toBe(0);
    expect(spot.x).toBeCloseTo(-CAM.back);
    expect(spot.y).toBeCloseTo(CAM.up);
    expect(spot.z).toBeCloseTo(0);
  });

  it('rises over a wall that blocks the low spot', () => {
    const wallBehind = (_from: THREE.Vector3, to: THREE.Vector3) => to.y < 4; // a 4 m wall behind the rider
    const spot = new THREE.Vector3();
    expect(chaseSpot(rider(), wallBehind, spot)).toBeGreaterThan(0);
    expect(spot.y).toBeGreaterThanOrEqual(4);
    expect(spot.x).toBeGreaterThan(-CAM.back);
  });

  it('goes overhead when every spot behind is blocked', () => {
    const spot = new THREE.Vector3();
    expect(chaseSpot(rider(), (_from, to) => to.x < -1, spot)).toBe(1);
    expect(spot.y).toBeCloseTo(CAM.topUp);
  });

  it('pulls back on big air', () => {
    const s = rider();
    s.pos.y = 3;
    s.groundY = 0;
    const spot = new THREE.Vector3();
    chaseSpot(s, open, spot);
    expect(spot.x).toBeLessThan(-CAM.back - 2);
  });
});
