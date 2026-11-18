// The hints round the Jump button. Tricks run on physics now: every bike can try every air trick, and a slow-spinning,
// low-popping bike needs a bigger jump to land it.
export function airHints(): { above: string; below: string } {
  return { above: 'swipe ↑ No-hander', below: '↓ Backflip · ←→ 360\nhold: Tabletop' };
}
