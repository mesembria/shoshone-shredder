// The speed ring, top left: 16 chunky segments over 240° that light up in order, colored by what's moving you (green
// pedaling up to the bike's cruise, yellow sprinting up to its sprint, orange hill speed up to its top speed, red past
// it), with the mph in the middle and the zone's word under it. Unlit segments show their zone dimmed, so you can see
// what's ahead. The full scale is the same on every bike, a little over the fastest one's top speed, so a faster bike
// visibly fills more.
import { BIKE_RIDE } from './bikes';
import { DEFAULTS } from './tune';

export const mph = (ms: number) => Math.round(ms * 2.237);

export type Zone = 'pedal' | 'sprint' | 'hill' | 'over';
export interface SpeedT { cruise: number; sprint: number; maxSpeed: number }
export const SEGMENTS = 16;
export const SPEED_FULL = Math.ceil(1.1 * Math.max(DEFAULTS.maxSpeed, ...Object.values(BIKE_RIDE).map((r) => r.maxSpeed ?? 0)));
export const ZONE_WORD: Record<Zone, string> = { pedal: 'pedal', sprint: 'sprint', hill: 'hill speed', over: 'hill speed' };

export const speedZone = (ms: number, t: SpeedT): Zone => (ms < t.cruise ? 'pedal' : ms < t.sprint ? 'sprint' : ms <= t.maxSpeed ? 'hill' : 'over');

// each segment's zone by its middle speed; the first round(speed share × 16) are lit
export function ringSegments(ms: number, t: SpeedT): { zone: Zone; lit: boolean }[] {
  const step = SPEED_FULL / SEGMENTS, lit = Math.round(Math.max(0, Math.min(1, ms / SPEED_FULL)) * SEGMENTS);
  return Array.from({ length: SEGMENTS }, (_, i) => ({ zone: speedZone((i + 0.5) * step, t), lit: i < lit }));
}

// ---- the DOM: an SVG of the 16 segments (centre 95,95, radius 72 ± 10, from -120° to +120°, 0 = straight up)
const CX = 95, CY = 95, R = 72, A0 = -120, A1 = 120;
const pt = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
};
function segmentPath(i: number): string {
  const step = (A1 - A0) / SEGMENTS, lo = A0 + i * step + 1.6, hi = A0 + (i + 1) * step - 1.6;
  return `M ${pt(lo, R + 10)} A ${R + 10} ${R + 10} 0 0 1 ${pt(hi, R + 10)} L ${pt(hi, R - 10)} A ${R - 10} ${R - 10} 0 0 0 ${pt(lo, R - 10)} Z`;
}

export function createSpeedRing(root: HTMLElement): { update(ms: number, t: SpeedT): void } {
  const el = document.createElement('div');
  el.className = 'speed';
  el.innerHTML = `<svg viewBox="0 0 190 180" aria-hidden="true">${Array.from({ length: SEGMENTS }, (_, i) => `<path class="seg" d="${segmentPath(i)}"/>`).join('')}</svg>
    <div class="read"><b class="num">0</b><span class="unit">mph</span></div><small class="word"></small>`;
  root.append(el);
  const segs = [...el.querySelectorAll<SVGPathElement>('.seg')], num = el.querySelector('.num')!, word = el.querySelector<HTMLElement>('.word')!;
  let shown = '';
  return {
    update(ms, t) {
      const segments = ringSegments(ms, t), zone = speedZone(ms, t), n = mph(ms);
      const key = `${n}|${zone}|${segments.map((s) => s.zone[0] + (s.lit ? 1 : 0)).join('')}`;
      if (key === shown) return;
      shown = key;
      segments.forEach((s, i) => segs[i].setAttribute('class', `seg ${s.zone}${s.lit ? ' lit' : ''}`));
      num.textContent = String(n);
      word.textContent = ZONE_WORD[zone];
      word.dataset.zone = zone;
    },
  };
}
