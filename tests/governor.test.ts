import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { createResolutionGovernor, GOVERNOR_WARMUP } from '../src/look/toyLook';

// a renderer stand-in that records every resolution change
function fakeRenderer(start = 1.5) {
  let ratio = start;
  const changes: number[] = [];
  const r = {
    getPixelRatio: () => ratio,
    setPixelRatio: (x: number) => { ratio = x; changes.push(x); },
    setSize: () => {},
  };
  return { renderer: r as unknown as THREE.WebGLRenderer, changes };
}

// feed `seconds` of frames, each `ms` long
function run(gov: (dt: number) => void, seconds: number, ms: number): void {
  for (let t = 0; t < seconds; t += ms / 1000) gov(ms / 1000);
}

describe('resolution governor', () => {
  vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 768 });

  it('holds still while a place warms up, however slow the first frames are', () => {
    const { renderer, changes } = fakeRenderer();
    const gov = createResolutionGovernor(renderer, 1.5);
    run(gov, GOVERNOR_WARMUP - 0.1, 100); // 10 fps: shaders compiling, backdrop uploading
    expect(changes).toEqual([]);
  });

  it('still steps down when frames stay slow after the warm-up', () => {
    const { renderer, changes } = fakeRenderer();
    const gov = createResolutionGovernor(renderer, 1.5);
    run(gov, GOVERNOR_WARMUP, 16.7);
    run(gov, 2.05, 30);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]).toBeCloseTo(1.35);
  });

  it('a warm-up is long enough to cover loading', () => {
    expect(GOVERNOR_WARMUP).toBeGreaterThanOrEqual(3);
  });
});
