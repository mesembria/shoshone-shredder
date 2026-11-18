export const HOP = { tap: 4.2, full: 6.0, holdMin: 0.12, holdFull: 0.42, perfectWindow: 0.15, perfectBonus: 1.25, lipShare: 0.6 };

// Upward speed in m/s. sinceLip: seconds since leaving a ramp lip, or null when not just off a lip.
export function hopSpeed(holdSeconds: number, sinceLip: number | null): number {
  const t = Math.min(1, Math.max(0, (holdSeconds - HOP.holdMin) / (HOP.holdFull - HOP.holdMin)));
  const v = HOP.tap + (HOP.full - HOP.tap) * t;
  return sinceLip !== null && sinceLip <= HOP.perfectWindow ? v * HOP.perfectBonus : v;
}
