import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';

// The UI art the game ships (built by art/ui/build.mjs from the masters in art/ui/): small enough for the iPads over
// wifi, and only the built files are in public/
const ART = ['sign-l', 'sign-m', 'sign-r', 'star-gold', 'star-empty', 'cog', 'hill-up', 'hill-down', 'hill-both'];
const DIR = 'public/ui';

describe('UI art', () => {
  for (const name of ART) {
    it(`${name}.webp is there and at most 40 KB`, () => {
      const f = `${DIR}/${name}.webp`;
      expect(existsSync(f)).toBe(true);
      expect(statSync(f).size).toBeLessThanOrEqual(40 * 1024);
    });
  }
  it('no sources or masters left in public', () => {
    expect(readdirSync(DIR).filter((f) => /\.(png|jpe?g)$/.test(f) || f === 'make' || f === 'README.md')).toEqual([]);
  });
});
