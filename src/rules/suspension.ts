// Bottoming out: a landing harder than the bike can take uses all its travel. The rider's legs take a base amount (the
// whole story on a rigid bike); fork and rear travel add to it, averaged, so a 130 mm hardtail fork gets half the help
// of a bike with 130 mm at both ends. An air spring ramps up near the end of its travel, so it resists bottoming a
// little more than a coil. The ride (src/lab/bike.ts) decides from this; the bike's springs only show it.
import type { Kit, SpringKind } from './bikes';

export interface BottomTune { bottomBase: number; bottomPerMm: number; airFactor: number; coilFactor: number; bottomMargin: number }

const factor = (kind: SpringKind | 'rigid', t: BottomTune) => (kind === 'coil' ? t.coilFactor : t.airFactor);

// The impact (m/s into the slope) the bike takes without bottoming out.
export function landingCapacity(kit: Kit, t: BottomTune): number {
  const fork = kit.fork.travel * factor(kit.fork.kind, t), rear = kit.rear.travel * factor(kit.rear.shock, t);
  return t.bottomBase + (t.bottomPerMm * (fork + rear)) / 2;
}

// used: impact / capacity. Over 1 it bottoms out (a clunk and a little speed lost); well over, it slams (a bobble).
export type BottomTier = 'within' | 'bottomed' | 'slammed';
export function bottomTier(used: number, margin: number): BottomTier {
  return used > 1 + margin ? 'slammed' : used > 1 ? 'bottomed' : 'within';
}
