// What each star needs and how close a run is to the next one: before a run (the ring card and the countdown medals),
// during it (the next-star strip) and after it (the result card). Every number comes from the challenge's goal or the trick tables, never typed in here.
import { CHALLENGES, canStart, type Goal, type Run } from './challenges';
import { TRICK_INFO } from '../rules/tricks';
import { MOVE_INFO } from '../lab/bike';
import type { Profile } from './progress';
import type { Loadout } from './catalog';
import type { AreaDef } from './areas';

const STARS = ['★', '★★', '★★★'] as const;
const byPoints = (g: Goal): [number, number, number] | null => (g.kind === 'jumps' || g.kind === 'plank' ? g.points : null);
const byTimes = (g: Goal): [number, number, number] => (g as { times: [number, number, number] }).times;

// The air tricks off the jumps, biggest first
const airTricks = (): [string, number][] =>
  ([
    [MOVE_INFO.flip.name, MOVE_INFO.flip.points],
    [MOVE_INFO.spin.name, MOVE_INFO.spin.points],
    [TRICK_INFO.nohander.name, TRICK_INFO.nohander.points],
    [TRICK_INFO.tabletop.name, TRICK_INFO.tabletop.points],
    ['Hop', TRICK_INFO.bunnyhop.points], // every lip pop is one, and adds to the ×
  ] as [string, number][]).sort((a, b) => b[1] - a[1]);

// ---- the riding HUD and the cards: one star at a time

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// points as they show everywhere: rounded down, with commas ("12,000")
export const fmtPoints = (n: number): string => Math.floor(n).toLocaleString('en-US');

// The next-star strip, under the sign while riding (and frozen on the result card). Only the next star still in play:
// on points goals the bar fills from the last star's points to the next one's (banked solid, the open combo striped
// ahead of it); on time goals a fuse burns down over the time left for the best star still in reach, then refills for
// the next one. The stars compare the real points and run.t, the same way tick() judges them (>= points, <= time).
export interface Strip {
  kind: 'points' | 'time';
  next: 1 | 2 | 3; // the star the bar is for (with full: the last one, won)
  full: boolean; // points: all three won, bar stays full
  have: string; // '2,449' (points, rounded down) or '12.3 s' (run.t)
  fill: number; // 0..1: banked points from the last star toward next, or the fuse left
  open: number; // 0..1: the open combo ahead of fill (points only); fill + open <= 1
  target: string; // '1,500' or 'under 14.6'
  red: boolean; // time: the ★ fuse in its last 10 s (and past the limit)
  left: number | null; // points: whole seconds left, only when <= 10 s remain; time: null
}
const LAST_SECONDS = 10;

export function nextStarStrip(goal: Goal, run: Run): Strip {
  const pts = byPoints(goal);
  if (pts) {
    const limit = (goal as { limit: number }).limit;
    const left = limit - run.t <= LAST_SECONDS ? Math.max(0, Math.ceil(limit - run.t)) : null;
    const base = { kind: 'points' as const, have: fmtPoints(run.points), red: false, left };
    const i = pts.findIndex((p) => run.points < p);
    if (i < 0) return { ...base, next: 3, full: true, fill: 1, open: 0, target: fmtPoints(pts[2]) };
    const prev = i ? pts[i - 1] : 0, span = pts[i] - prev;
    const fill = clamp01((run.banked - prev) / span);
    return { ...base, next: (i + 1) as 1 | 2 | 3, full: false, fill, open: clamp01((run.points - prev) / span) - fill, target: fmtPoints(pts[i]) };
  }
  const [limit, two, three] = byTimes(goal), t = run.t;
  const [next, start, end] = t <= three ? [3, 0, three] as const : t <= two ? [2, three, two] as const : [1, two, limit] as const;
  return {
    kind: 'time', next, full: false, have: `${t.toFixed(1)} s`, fill: clamp01((end - t) / (end - start)), open: 0,
    target: `under ${String(byTimes(goal)[next - 1])}`, red: next === 1 && limit - t <= LAST_SECONDS, left: null,
  };
}

// The strip frozen on the result card. A time run that missed a star shows that star with its fuse out, matching the
// "2.7 s faster for ★★★" line under it; points runs and 3-star runs show the strip as the run ended.
export function resultStrip(goal: Goal, run: Run, stars: 1 | 2 | 3): Strip {
  const s = nextStarStrip(goal, run);
  if (s.kind !== 'time' || stars === 3) return s;
  const next = (stars + 1) as 2 | 3;
  return { ...s, next, fill: 0, red: false, target: `under ${String(byTimes(goal)[next - 1])}` };
}

// The cream tag under the sign, from tick()'s progress: a count of five or fewer as pips ("Jumps ●○○"), more in words
// ("Gates 4 of 10"), anything else as it is
export function goalTag(progress: string): { text: string; pips: [number, number] | null } {
  const m = /^(\w+) (\d+)\/(\d+)$/.exec(progress);
  if (!m) return { text: progress, pips: null };
  const [, word, n, total] = m;
  return +total <= 5 ? { text: word, pips: [+n, +total] } : { text: `${word} ${n} of ${total}`, pips: null };
}

// The three star medals (ring card, countdown): won or not, what it needs, and what it pays (starPays' left, in order)
export interface Medal { won: boolean; target: string; pays: number | null }
export function starMedals(goal: Goal, pays: { have: number; left: number[] }): Medal[] {
  const pts = byPoints(goal), times = pts ? null : byTimes(goal);
  return [0, 1, 2].map((i) => {
    const won = i < pays.have;
    return { won, target: pts ? `${fmtPoints(pts[i])} points` : `under ${String(times![i])} s`, pays: won ? null : pays.left[i - pays.have] ?? null };
  });
}

// What tricks are worth, as chips on a points challenge's ring card, and where they score; null for timed ones
export const COMBO_TIP = 'More tricks in one jump = bigger ×';
export function trickChips(goal: Goal): { where: string; chips: [string, string][] } | null {
  if (goal.kind === 'plank') return { where: 'On the plank', chips: [['Manual', `${TRICK_INFO.manual.points} a second`], ['Bunny hop', `${TRICK_INFO.bunnyhop.points}`]] };
  if (goal.kind !== 'jumps') return null;
  return { where: 'Off the jumps', chips: airTricks().map(([n, p]) => [n, String(p)]) };
}

// The result card: how far this run was from its next star, or null at 3★
export function toNextStar(goal: Goal, run: Run, stars: 1 | 2 | 3): string | null {
  if (stars === 3) return null;
  const want = STARS[stars];
  const pts = byPoints(goal);
  if (pts) {
    const n = Math.max(1, Math.ceil(pts[stars] - run.points));
    return `${fmtPoints(n)} more point${n === 1 ? '' : 's'} for ${want}`;
  }
  // rounded up to a tenth (never "0.0": 14.63 s shows as 14.6 but missed 14.6)
  const gap = Math.max(0.1, Math.ceil((run.t - byTimes(goal)[stars]) * 10 - 1e-6) / 10);
  return `${gap.toFixed(1)} s faster for ${want}`;
}

// Challenges (by name, in ids order) that were locked before and can start now
export function newlyOpen(before: Profile, after: Profile, l: Loadout, ids: string[]): string[] {
  return ids
    .map((id) => CHALLENGES.find((c) => c.id === id))
    .filter((c) => !!c && !canStart(before, c, l) && canStart(after, c, l))
    .map((c) => c!.name);
}

// The same across every place (stars count in all of them, so a star here can open something there): a challenge in
// another place is named with it, "Cone Zone at Mesa Jump Park". `here` is the place the rider is in.
export function newlyOpenAnywhere(before: Profile, after: Profile, l: Loadout, areas: AreaDef[], here: string): string[] {
  return areas.flatMap((a) => newlyOpen(before, after, l, a.challenges).map((n) => (a.id === here ? n : `${n} at ${a.name}`)));
}

export function openedLine(names: string[]): string | null {
  if (!names.length) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `🔓 ${list} ${names.length === 1 ? 'is' : 'are'} open!`;
}
