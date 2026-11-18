import { describe, it, expect } from 'vitest';
import { CHALLENGES, startRun, type ChallengeDef, type Run } from '../src/game/challenges';
import { toNextStar, newlyOpen, newlyOpenAnywhere, openedLine, nextStarStrip, resultStrip, goalTag, starMedals, trickChips } from '../src/game/targets';
import { TRICK_INFO } from '../src/rules/tricks';
import { AREAS } from '../src/game/areas';
import { loadoutOf, newProfile, type Profile } from '../src/game/progress';

// made-up challenges with fixed numbers, so retuning the real targets never breaks the wording tests
const FAKE: ChallengeDef[] = [
  { id: 'fakeJumps', name: 'Fake Jumps', group: 'park', spot: 'Jumps S', tell: '', goal: { kind: 'jumps', count: 3, limit: 30, points: [150, 1500, 2700] } },
  { id: 'fakeLap', name: 'Fake Lap', group: 'park', spot: 'Pump track', tell: '', goal: { kind: 'lap', times: [45, 15.4, 14.6] } },
];
const byId = (id: string) => FAKE.find((c) => c.id === id) ?? CHALLENGES.find((c) => c.id === id)!;
const runOf = (id: string, at: Partial<Pick<Run, 't' | 'points' | 'count' | 'banked' | 'open'>>): Run => Object.assign(startRun(byId(id)), at);
const next = (id: string, at: Partial<Run>, stars: 1 | 2 | 3) => toNextStar(byId(id).goal, runOf(id, at), stars);

describe('how far from the next star', () => {
  it('points', () => {
    expect(next('fakeJumps', { points: 640 }, 1)).toBe('860 more points for ★★');
    expect(next('fakeJumps', { points: 1499.2 }, 1)).toBe('1 more point for ★★');
  });
  it('on the target', () => {
    expect(next('fakeJumps', { points: 1500 }, 2)).toBe('1,200 more points for ★★★');
  });
  it('times', () => {
    expect(next('fakeLap', { t: 15 }, 2)).toBe('0.4 s faster for ★★★');
    expect(next('fakeLap', { t: 15.04 }, 2)).toBe('0.5 s faster for ★★★');
    expect(next('fakeLap', { t: 20 }, 1)).toBe('4.6 s faster for ★★');
  });
  it('gap never reads 0.0', () => {
    expect(next('fakeLap', { t: 14.63 }, 2)).toBe('0.1 s faster for ★★★');
  });
  it('nothing at 3 stars', () => {
    expect(next('fakeJumps', { points: 3000 }, 3)).toBeNull();
    expect(next('fakeLap', { t: 10 }, 3)).toBeNull();
  });
});

describe('what a new star opens', () => {
  const ids = AREAS.flatMap((a) => a.challenges);
  const fresh = newProfile('A');
  const withStars = (stars: Record<string, number>): Profile => ({ ...fresh, stars });
  const one = withStars({ tableSmall: 1 }), two = withStars({ tableSmall: 2 });
  it('names the challenges that were locked and now are open', () => {
    expect(newlyOpen(fresh, one, loadoutOf(fresh), ids)).toEqual(['Cone Zone']);
    expect(newlyOpen(one, one, loadoutOf(one), ids)).toEqual([]);
  });
  it('two open at once', () => {
    expect(newlyOpen(one, two, loadoutOf(one), ids)).toEqual(['Table Row Medium', 'The Pump House']);
    expect(openedLine(['Table Row Medium', 'The Pump House'])).toBe('🔓 Table Row Medium and The Pump House are open!');
  });
  it('a star in one place names what it opened in the other', () => {
    const hill = withStars({ goatUp: 1 }), l = loadoutOf(fresh);
    expect(newlyOpen(fresh, hill, l, AREAS[0].challenges)).toEqual([]); // the hill's own list misses it
    expect(newlyOpenAnywhere(fresh, hill, l, AREAS, 'shredderHills')).toEqual(['Cone Zone at Mesa Jump Park']);
    // and from the park: the same star counts, the name carries no place for the park's own challenges
    expect(newlyOpenAnywhere(fresh, hill, l, AREAS, 'mesaJumpPark')).toEqual(['Cone Zone']);
    const three = withStars({ tableSmall: 3 });
    expect(newlyOpenAnywhere(fresh, three, l, AREAS, 'mesaJumpPark')).toContain('Hairpin Hollow ↑ at Shredder Hills');
  });
  it('one sentence, or nothing', () => {
    expect(openedLine([])).toBeNull();
    expect(openedLine(['Cone Zone'])).toBe('🔓 Cone Zone is open!');
    expect(openedLine(['A', 'B', 'C'])).toBe('🔓 A, B and C are open!');
  });
});

const strip = (id: string, at: Partial<Run>) => nextStarStrip(byId(id).goal, runOf(id, at));

describe('the next-star strip, points', () => {
  it('starts empty toward ★', () => expect(strip('fakeJumps', {})).toEqual({ kind: 'points', next: 1, full: false, have: '0', fill: 0, open: 0, target: '150', red: false, left: null }));
  it('banked is solid, the open combo striped ahead of it, from the last star', () => {
    const s = strip('fakeJumps', { banked: 900, open: 300, points: 1200 });
    expect([s.next, s.target, s.have]).toEqual([2, '1,500', '1,200']);
    expect(s.fill).toBeCloseTo(750 / 1350);
    expect(s.open).toBeCloseTo(300 / 1350);
  });
  it('rounds points down', () => expect(strip('fakeJumps', { banked: 2449.6, points: 2449.6 }).have).toBe('2,449'));
  it('on the target the bar starts over', () => expect(strip('fakeJumps', { banked: 1500, points: 1500 })).toMatchObject({ next: 3, fill: 0, target: '2,700' }));
  it('the strip follows points down', () => expect(strip('fakeJumps', { banked: 1400, points: 1400 })).toMatchObject({ next: 2 }));
  it('after ★★★ it stays full', () => expect(strip('fakeJumps', { banked: 3000, points: 3000 })).toMatchObject({ next: 3, full: true, fill: 1, open: 0, target: '2,700' }));
  it('the red chip only in the last 10 s', () => {
    expect(strip('fakeJumps', { t: 19.9 }).left).toBeNull();
    expect(strip('fakeJumps', { t: 20.5 }).left).toBe(10);
    expect(strip('fakeJumps', { t: 31 }).left).toBe(0);
  });
});

describe('the next-star strip, time', () => {
  it('a full ★★★ fuse at GO', () => expect(strip('fakeLap', {})).toEqual({ kind: 'time', next: 3, full: false, have: '0.0 s', fill: 1, open: 0, target: 'under 14.6', red: false, left: null }));
  it('burns down', () => expect(strip('fakeLap', { t: 7.3 }).fill).toBeCloseTo(0.5));
  it("the fuse holds on the star's own time", () => expect(strip('fakeLap', { t: 14.6 })).toMatchObject({ next: 3, fill: 0 }));
  it('then refills for ★★', () => {
    const s = strip('fakeLap', { t: 14.61 });
    expect([s.next, s.target]).toEqual([2, 'under 15.4']);
    expect(s.fill).toBeCloseTo((15.4 - 14.61) / 0.8);
  });
  it('★ burns to the limit, red for its last 10 s', () => {
    expect(strip('fakeLap', { t: 34.9 })).toMatchObject({ next: 1, target: 'under 45', red: false });
    expect(strip('fakeLap', { t: 35 }).red).toBe(true);
  });
  it('past the limit', () => expect(strip('fakeLap', { t: 46 })).toMatchObject({ next: 1, fill: 0, red: true }));
});

describe('goal tag', () => {
  it('five or fewer: pips', () => {
    expect(goalTag('Jumps 1/3')).toEqual({ text: 'Jumps', pips: [1, 3] });
    expect(goalTag('Jumps 5/5')).toEqual({ text: 'Jumps', pips: [5, 5] });
  });
  it('more: words', () => expect(goalTag('Gates 4/10')).toEqual({ text: 'Gates 4 of 10', pips: null }));
  it('anything else as it is', () => {
    expect(goalTag('To the top!')).toEqual({ text: 'To the top!', pips: null });
    expect(goalTag('')).toEqual({ text: '', pips: null });
  });
});

describe('medals', () => {
  it('points: won, then what each pays', () =>
    expect(starMedals(byId('fakeJumps').goal, { have: 1, left: [90, 150] })).toEqual([
      { won: true, target: '150 points', pays: null },
      { won: false, target: '1,500 points', pays: 90 },
      { won: false, target: '2,700 points', pays: 150 },
    ]));
  it('times', () => expect(starMedals(byId('fakeLap').goal, { have: 0, left: [45, 90, 150] }).map((m) => m.target)).toEqual(['under 45 s', 'under 15.4 s', 'under 14.6 s']));
  it('all won', () => expect(starMedals(byId('fakeLap').goal, { have: 3, left: [] }).every((m) => m.won && m.pays === null)).toBe(true));
});

describe('trick chips', () => {
  it('jumps, biggest first, from the game numbers', () =>
    expect(trickChips(byId('fakeJumps').goal)).toEqual({ where: 'Off the jumps', chips: [['Backflip', '400'], ['360', '300'], ['No-hander', '200'], ['Tabletop', '150'], ['Hop', '50']] }));
  it('plank', () => expect(trickChips(byId('plank').goal)).toEqual({ where: 'On the plank', chips: [['Manual', `${TRICK_INFO.manual.points} a second`], ['Bunny hop', `${TRICK_INFO.bunnyhop.points}`]] }));
  it('timed: none', () => expect(trickChips(byId('fakeLap').goal)).toBeNull());
});

describe('the strip on the result card', () => {
  it('a time run shows the star it missed, its fuse out', () =>
    expect(resultStrip(byId('fakeLap').goal, runOf('fakeLap', { t: 15.1 }), 2)).toMatchObject({ kind: 'time', next: 3, fill: 0, target: 'under 14.6', have: '15.1 s', red: false }));
  it('a 3-star time run keeps its fuse', () => expect(resultStrip(byId('fakeLap').goal, runOf('fakeLap', { t: 7.3 }), 3)).toEqual(nextStarStrip(byId('fakeLap').goal, runOf('fakeLap', { t: 7.3 }))));
  it('points: as it ended', () => expect(resultStrip(byId('fakeJumps').goal, runOf('fakeJumps', { banked: 200, points: 200 }), 1)).toEqual(nextStarStrip(byId('fakeJumps').goal, runOf('fakeJumps', { banked: 200, points: 200 }))));
});
