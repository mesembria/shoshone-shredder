import { describe, it, expect } from 'vitest';
import { CHALLENGES, DOWNHILL_BOOST, canStart, lockText, startRun, tick, trickTick, type ChallengeDef, type Tick, type Status } from '../src/game/challenges';
import { EMPTY_COMBO } from '../src/rules/tricks';
import { loadout, partsFor, stockFitted, SLOTS } from '../src/game/catalog';
import { LAB_ORDER } from '../src/lab/bikes';
import { statsFor } from '../src/game/stats';
import { pairHint } from '../src/game/challenges';
import { loadoutOf, newProfile, type Profile } from '../src/game/progress';

const def = (goal: ChallengeDef['goal'], group: ChallengeDef['group'] = 'park'): ChallengeDef => ({ id: 'test', name: 'Test', group, spot: 'Street', tell: '', goal });
const play = (d: ChallengeDef, ticks: Tick[]): Status => {
  const run = startRun(d);
  let st: Status = { state: 'running', progress: '' };
  for (const t of ticks) {
    st = tick(run, t);
    if (st.state !== 'running') break;
  }
  return st;
};
const wait = (s: number): Tick => ({ dt: s });

describe('gates', () => {
  const slalom = def({ kind: 'gates', count: 3, times: [20, 10, 6] });
  it('finishes after every gate in order, with stars for speed', () => {
    expect(play(slalom, [{ dt: 1, gate: 0 }, { dt: 1, gate: 1 }, { dt: 1, gate: 2 }])).toEqual({ state: 'done', stars: 3 });
    expect(play(slalom, [{ dt: 1, gate: 0 }, wait(5), { dt: 1, gate: 1 }, { dt: 1, gate: 2 }])).toEqual({ state: 'done', stars: 2 });
    expect(play(slalom, [{ dt: 1, gate: 0 }, wait(10), { dt: 1, gate: 1 }, { dt: 1, gate: 2 }])).toEqual({ state: 'done', stars: 1 });
  });

  it('ignores a gate taken out of order', () => {
    const st = play(slalom, [{ dt: 1, gate: 0 }, { dt: 1, gate: 2 }, { dt: 1, gate: 1 }]);
    expect(st).toMatchObject({ state: 'running', progress: 'Gates 2/3' });
  });

  it('runs out of time', () => {
    expect(play(slalom, [{ dt: 1, gate: 0 }, wait(25)])).toMatchObject({ state: 'failed', why: 'Out of time' });
  });
});

describe('jumps', () => {
  const tables = def({ kind: 'jumps', count: 2, limit: 30, points: [100, 300, 800] });
  // a landing step: the combo total still open after it, and any combo total banked on it
  const land = (open = 0, bank = 0): Tick => ({ dt: 1, landed: 'clean', airTime: 0.8, fromLip: true, open, bank });
  const banks = (n: number) => land(0, n);
  it('counts clean landings with real air and gives stars for trick points', () => {
    expect(play(tables, [banks(50), banks(50)])).toEqual({ state: 'done', stars: 1 });
    expect(play(tables, [banks(150), banks(200)])).toEqual({ state: 'done', stars: 2 });
    expect(play(tables, [banks(400), banks(400)])).toEqual({ state: 'done', stars: 3 });
  });

  it('clearing every jump with too few trick points is not a star (Park stars are points)', () => {
    expect(play(tables, [land(), land()])).toEqual({ state: 'failed', why: 'Not enough tricks!' });
    expect(play(tables, [banks(50), banks(49)])).toEqual({ state: 'failed', why: 'Not enough tricks!' });
  });

  it('does not count a little bump as a jump', () => {
    expect(play(tables, [{ dt: 1, landed: 'clean', airTime: 0.1, fromLip: true }, land()])).toMatchObject({ state: 'running', progress: 'Jumps 1/2' });
  });

  it('does not count a bunny hop on the flat as a jump', () => {
    expect(play(tables, [{ dt: 1, landed: 'clean', airTime: 0.8 }, land()])).toMatchObject({ state: 'running', progress: 'Jumps 1/2' });
  });

  it('a crash on a Park challenge sends you back to the start', () => {
    expect(play(tables, [land(), { dt: 1, landed: 'wipeout', airTime: 0.9, fromLip: true }])).toEqual({ state: 'restart' });
    expect(play(tables, [banks(150), { dt: 1, landed: 'big' }])).toEqual({ state: 'restart' });
    // a bobble is not a crash
    expect(play(tables, [{ dt: 1, landed: 'bobble', airTime: 0.8, fromLip: true }])).toMatchObject({ state: 'running', progress: 'Jumps 1/2' });
  });

  it('fails when you ride away from the spot', () => {
    expect(play(tables, [land(), { dt: 1, left: true }])).toMatchObject({ state: 'failed' });
  });
  it('points are banked combo totals plus the open combo', () => {
    const run = startRun(tables);
    for (const k of [{ dt: 1, open: 300 }, { dt: 1, bank: 300, open: 0 }, { dt: 1, open: 200 }]) tick(run, k);
    expect(run.points).toBe(500);
  });

  it('the open combo at the finish counts', () => {
    expect(play(tables, [land(0, 0), land(450)])).toEqual({ state: 'done', stars: 2 });
  });
});

describe('trickTick', () => {
  it('turns the bike\'s combo into the tick: what banked this step, and the open total', () => {
    expect(trickTick(undefined, { points: 450, count: 3 })).toEqual({ bank: 0, open: 1350 });
    expect(trickTick(900, EMPTY_COMBO)).toEqual({ bank: 900, open: 0 });
  });
});

describe('lap', () => {
  const lap = def({ kind: 'lap', times: [40, 25, 18] });
  it('needs the far side before the finish line counts', () => {
    expect(play(lap, [wait(5), { dt: 1, lap: 'start' }])).toMatchObject({ state: 'running' });
    expect(play(lap, [wait(8), { dt: 1, lap: 'check' }, wait(8), { dt: 1, lap: 'start' }])).toEqual({ state: 'done', stars: 3 });
    expect(play(lap, [wait(10), { dt: 1, lap: 'check' }, wait(12), { dt: 1, lap: 'start' }])).toEqual({ state: 'done', stars: 2 });
  });
});

describe('plank', () => {
  const plank = def({ kind: 'plank', limit: 20, points: [40, 100, 250] });
  it('finishes at the end of the plank, with stars for manual points', () => {
    expect(play(plank, [{ dt: 1, plank: 'on' }, { dt: 1, open: 40 }, { dt: 1, plank: 'end' }])).toEqual({ state: 'done', stars: 1 });
    expect(play(plank, [{ dt: 1, plank: 'on' }, { dt: 2, open: 300 }, { dt: 1, plank: 'end' }])).toEqual({ state: 'done', stars: 3 });
    expect(play(plank, [{ dt: 1, plank: 'on' }, { dt: 1, plank: 'end' }])).toEqual({ state: 'failed', why: 'Not enough tricks!' });
  });

  it('the open combo counts when the end line comes mid-manual', () => {
    expect(play(plank, [{ dt: 1, plank: 'on' }, { dt: 1, open: 120 }, { dt: 1, plank: 'end', open: 160 }])).toEqual({ state: 'done', stars: 2 });
  });

  it('fails when you fall off', () => {
    expect(play(plank, [{ dt: 1, plank: 'on' }, { dt: 1, plank: 'off' }])).toMatchObject({ state: 'failed', why: 'Fell off the plank' });
  });

  it('does not count falling off before you got on', () => {
    expect(play(plank, [{ dt: 1, plank: 'off' }, { dt: 1, plank: 'on' }])).toMatchObject({ state: 'running' });
  });
});

describe('the challenge list', () => {
  it('has unique ids, and exactly the area\'s challenges', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    expect(CHALLENGES.map((c) => c.id).sort()).toEqual(
      ['goatUp', 'goatDown', 'goatBoth', 'hairpinUp', 'hairpinDown', 'hairpinBoth', 'boulderDash', 'tableSmall', 'tableMedium', 'tableBig', 'tableXL', 'whoop', 'pumpHouse', 'coneZone', 'plank'].sort(),
    );
  });

  it('names the runs for their trail and direction, in the right group', () => {
    const c = (id: string) => CHALLENGES.find((x) => x.id === id)!;
    expect([c('goatUp').name, c('goatDown').name, c('goatBoth').name]).toEqual(['Goat Ladder ↑', 'Goat Ladder ↓', 'Goat Ladder ↕']);
    expect([c('hairpinUp').group, c('hairpinDown').group, c('hairpinBoth').group, c('boulderDash').group]).toEqual(['trail', 'downhill', 'trail', 'downhill']);
    for (const id of ['goatBoth', 'hairpinBoth']) expect(c(id).goal, id).toMatchObject({ kind: 'run', via: true });
    for (const k of CHALLENGES.filter((x) => x.group === 'park')) expect(k.goal.kind, k.id).not.toBe('run');
  });

  it('has the robot-tuned downhill boost (at 3 a landed trick gained nothing on Goat Ladder down; at 5 it gains about half a second)', () => {
    expect(DOWNHILL_BOOST).toBe(5);
  });
});

describe('run (start line to finish line)', () => {
  const chute = def({ kind: 'run', times: [60, 30, 22] }, 'downhill');
  it('is done after the start then the finish', () => {
    expect(play(chute, [{ dt: 1, run: 'start' }, wait(10), { dt: 1, run: 'finish' }])).toEqual({ state: 'done', stars: 3 });
  });

  it('ignores the finish before the start', () => {
    expect(play(chute, [{ dt: 1, run: 'finish' }])).toMatchObject({ state: 'running', progress: 'Go!' });
    expect(play(chute, [{ dt: 1, run: 'start' }])).toMatchObject({ state: 'running', progress: 'To the finish!' });
  });

  it('a crash on a Trail run only costs time too', () => {
    const climb = def({ kind: 'run', times: [60, 30, 22] }, 'trail');
    expect(play(climb, [{ dt: 1, run: 'start' }, { dt: 1, landed: 'wipeout' }])).toMatchObject({ state: 'running', progress: 'To the finish!' });
  });

  it('runs out of time; a crash only costs time', () => {
    expect(play(chute, [{ dt: 1, run: 'start' }, wait(61)])).toMatchObject({ state: 'failed', why: 'Out of time' });
    expect(play(chute, [{ dt: 1, run: 'start' }, { dt: 1, landed: 'wipeout' }])).toMatchObject({ state: 'running', progress: 'To the finish!' });
    expect(play(chute, [{ dt: 1, run: 'start' }, { dt: 1, landed: 'big' }, wait(20), { dt: 1, run: 'finish' }])).toEqual({ state: 'done', stars: 2 });
  });

  it('has the timed runs', () => {
    for (const id of ['goatUp', 'goatDown', 'goatBoth', 'hairpinUp', 'hairpinDown', 'hairpinBoth', 'boulderDash']) expect(CHALLENGES.find((c) => c.id === id)!.goal.kind, id).toBe('run');
  });

  // the route keeps you to the trail (src/game/stayOnTrail.ts), so the top is on the way: it only changes what the
  // banner says
  it('a both-ways run says To the top! until the top, then To the finish!', () => {
    const both = def({ kind: 'run', times: [60, 30, 22], via: true });
    expect(play(both, [{ dt: 1, run: 'start' }, wait(5)])).toMatchObject({ state: 'running', progress: 'To the top!' });
    expect(play(both, [{ dt: 1, run: 'start' }, wait(5), { dt: 1, top: true }])).toMatchObject({ state: 'running', progress: 'To the finish!' });
    expect(play(both, [{ dt: 1, run: 'start' }, wait(5), { dt: 1, top: true }, wait(5), { dt: 1, run: 'finish' }])).toEqual({ state: 'done', stars: 3 });
    expect(play(both, [{ dt: 1, top: true }, { dt: 1, run: 'start' }])).toMatchObject({ state: 'running', progress: 'To the top!' }); // the top only counts after the start
  });
});

const ch = (id: string) => CHALLENGES.find((c) => c.id === id)!;
const withStars = (p: Profile, stars: Record<string, number>): Profile => ({ ...p, stars: { ...p.stars, ...stars } });
const stockOf = (b: 'hardtail' | 'dirtjumper' | 'enduro' | 'bolinas') => loadout(b, stockFitted(b));

const STABLE = ch('boulderDash').need!.stat![1];
describe('locks', () => {
  const fresh = newProfile('Ada');
  it('a fresh rider can start exactly Goat Ladder ↑, Goat Ladder ↓ and Table Row Small', () => {
    const open = CHALLENGES.filter((c) => canStart(fresh, c, loadoutOf(fresh))).map((c) => c.id);
    expect(open.sort()).toEqual(['goatDown', 'goatUp', 'tableSmall']);
    for (const id of ['goatUp', 'goatDown', 'tableSmall']) expect(lockText(fresh, ch(id), loadoutOf(fresh)), id).toBeNull();
  });

  it('opens star locks with stars, wherever they are', () => {
    expect(canStart(fresh, ch('coneZone'), loadoutOf(fresh))).toBe(false);
    expect(lockText(fresh, ch('hairpinUp'), loadoutOf(fresh))).toBe('Ride 3 ★');
    const p = withStars(fresh, { goatUp: 2, goatDown: 1 });
    for (const id of ['coneZone', 'tableMedium', 'pumpHouse', 'hairpinUp', 'hairpinDown']) expect(canStart(p, ch(id), loadoutOf(p)), id).toBe(true);
    expect(lockText(p, ch('plank'), loadoutOf(p))).toMatch(/^Needs Flick 3.6 · /); // its stars are met, then Flick (see below)
    expect(canStart(p, ch('tableBig'), loadoutOf(p))).toBe(false);
    expect(canStart(withStars(fresh, { bogus: 9 }), ch('coneZone'), loadoutOf(fresh))).toBe(false); // stars on no challenge don't count
  });

  it('a ↕ run opens once its ↑ and ↓ are cleared', () => {
    const l = loadoutOf(fresh);
    expect(canStart(fresh, ch('goatBoth'), l)).toBe(false);
    expect(lockText(fresh, ch('goatBoth'), l)).toBe('Clear Goat Ladder ↑ and ↓ first');
    const up = withStars(fresh, { goatUp: 3 });
    expect(canStart(up, ch('goatBoth'), l)).toBe(false);
    expect(lockText(up, ch('goatBoth'), l)).toBe('Clear Goat Ladder ↓ first');
    expect(canStart(withStars(up, { goatDown: 1 }), ch('goatBoth'), l)).toBe(true);
    const hp = withStars(fresh, { goatUp: 3, hairpinUp: 1 });
    expect(canStart(hp, ch('hairpinBoth'), l)).toBe(false);
    expect(canStart(withStars(hp, { hairpinDown: 1 }), ch('hairpinBoth'), l)).toBe(true);
  });

  it('a stat lock opens with the right bike or part', () => {
    // Table Row XL and Whoop-de-Doo are open to every bike once you have the stars (their higher stars favor the Dirt Jumper)
    expect(canStart(fresh, ch('tableXL'), loadoutOf(fresh))).toBe(false);
    expect(lockText(fresh, ch('tableXL'), loadoutOf(fresh))).toBe('Ride 5 ★');
    const five = withStars(fresh, { goatUp: 2, goatDown: 2, tableSmall: 1 });
    expect(canStart(five, ch('tableXL'), loadoutOf(five))).toBe(true); // the bare hardtail can try it
    expect(canStart(withStars(fresh, { goatUp: 2, goatDown: 2 }), ch('whoop'), loadoutOf(fresh))).toBe(true);
    // Boulder Dash: stars, then Stable. Two hardtail parts (Air fork and Wide bars), the Bolinas long fork or the enduro open it.
    const p = withStars(fresh, { goatUp: 2, goatDown: 2 });
    expect(canStart(p, ch('boulderDash'), loadoutOf(p))).toBe(false);
    expect(lockText(p, ch('boulderDash'), loadoutOf(p))).toBe(`Needs Stable ${STABLE} · get the Air fork and Wide bars`);
    const parts = loadout('hardtail', { ...stockFitted('hardtail'), suspension: 'hardtail-air-fork', cockpit: 'hardtail-wide-bars' });
    expect(canStart(p, ch('boulderDash'), parts)).toBe(true);
    expect(canStart(p, ch('boulderDash'), stockOf('enduro'))).toBe(true);
  });

  it('no Park challenge is locked to one bike by Pop', () => {
    expect(CHALLENGES.filter((c) => c.group === 'park' && c.need?.stat?.[0] === 'pop').map((c) => c.id)).toEqual([]);
  });

  it('the Plank needs an upgrade: the bare hardtail cannot start it, its Fast tires open it', () => {
    // manuals score the same on every bike, so a skilled kid would 3-star it on the starter bike without a lock
    const p = withStars(fresh, { goatUp: 1, tableSmall: 1 });
    expect(canStart(p, ch('plank'), loadoutOf(p))).toBe(false);
    expect(canStart(p, ch('plank'), loadout('hardtail', { ...stockFitted('hardtail'), tires: 'hardtail-fast-tires' }))).toBe(true);
  });

  it('the stat thresholds: the stock hardtail fails, the matching stock bike passes', () => {
    const need = (id: string) => ch(id).need!.stat!;
    for (const [id, bike] of [['boulderDash', 'enduro'], ['plank', 'dirtjumper']] as const) {
      const [s, n] = need(id);
      expect(statsFor(stockOf('hardtail'))[s], id).toBeLessThan(n);
      expect(statsFor(stockOf(bike))[s], id).toBeGreaterThanOrEqual(n);
    }
  });

  it('no stat lock sits within 0.15 of a stat some build reaches (so rounding never decides a lock)', () => {
    for (const c of CHALLENGES.filter((x) => x.need?.stat)) {
      const [s, n] = c.need!.stat!;
      for (const b of LAB_ORDER) {
        let mixes: Record<string, string>[] = [{}];
        for (const slot of SLOTS) mixes = mixes.flatMap((f) => [f, ...partsFor(b, slot).filter((p) => !p.stock).map((p) => ({ ...f, [slot]: p.id }))]);
        for (const f of mixes) expect(Math.abs(statsFor(loadout(b, f))[s] - n), `${c.id} ${b} ${JSON.stringify(f)}`).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('hints a cheap part of the ridden bike before a shop bike', () => {
    const p = withStars(fresh, { goatUp: 2, goatDown: 2 });
    // the Plank: the 45 ⚙ Fast tires open it, no need for the Dirt Jumper
    expect(lockText(p, ch('plank'), loadoutOf(p))).toBe('Needs Flick 3.6 · get the Fast tires');
    // Boulder Dash: no single hardtail part reaches Stable, but the Air fork and Wide bars do
    expect(lockText(p, ch('boulderDash'), loadoutOf(p))).toMatch(/^Needs Stable [\d.]+ · get the (Air fork and Wide bars|Wide bars and Air fork)$/);
    // a hint never promises what the lock then refuses
    const tires = loadout('hardtail', { ...stockFitted('hardtail'), tires: 'hardtail-fast-tires' });
    expect(canStart(p, ch('plank'), tires)).toBe(true);
  });

  it('names an owned bike or an owned part before a part to buy', () => {
    const own: Profile = { ...withStars(fresh, { goatUp: 2, goatDown: 2 }), bikes: { ...fresh.bikes, enduro: { parts: [], fitted: stockFitted('enduro'), color: 0 } } };
    expect(lockText(own, ch('boulderDash'), loadoutOf(own))).toBe(`Needs Stable ${STABLE} · try your Enduro`);
    const ht = fresh.bikes.hardtail!;
    const fork: Profile = { ...withStars(fresh, { goatUp: 2, goatDown: 2 }), bikes: { hardtail: { ...ht, parts: ['hardtail-wide-bars'], fitted: { ...ht.fitted, suspension: 'hardtail-air-fork' } } } };
    // the fork is fitted but not owned, so it rides stock; the owned bars alone do not reach Stable 6, so the shop fork is named with them
    // the owned bars are "fit your", only the fork is something to buy
    expect(lockText(fork, ch('boulderDash'), loadoutOf(fork))).toBe(`Needs Stable ${STABLE} · get the Air fork and fit your Wide bars`);
    const both: Profile = { ...fork, bikes: { hardtail: { ...fork.bikes.hardtail!, parts: ['hardtail-wide-bars', 'hardtail-air-fork'], fitted: { ...ht.fitted, suspension: 'hardtail-air-fork' } } } };
    expect(lockText(both, ch('boulderDash'), loadoutOf(both))).toBe(`Needs Stable ${STABLE} · fit your Wide bars`);
  });

  it('locks gate starting, not finishing', () => {
    // started on the enduro, swapped to the stock hardtail (which fails the lock) mid-run: the run carries on
    const p = withStars(fresh, { goatUp: 2, goatDown: 2 });
    expect(canStart(p, ch('boulderDash'), stockOf('enduro'))).toBe(true);
    expect(canStart(p, ch('boulderDash'), stockOf('hardtail'))).toBe(false);
    // tick takes the run and the step, never the profile or the loadout: extra arguments change nothing
    const step: Tick = { dt: 1, run: 'start' }, loose = tick as unknown as (...a: unknown[]) => Status;
    expect(loose(startRun(ch('boulderDash')), step, stockOf('hardtail'), p)).toEqual(tick(startRun(ch('boulderDash')), step));
    expect(play(ch('boulderDash'), [{ dt: 1, run: 'start' }, wait(20), { dt: 1, run: 'finish' }])).toEqual({ state: 'done', stars: 1 });
    const xl = startRun(ch('tableXL')), xlGoal = ch('tableXL').goal as { points: number[] };
    expect(tick(xl, { dt: 2, landed: 'clean', airTime: 1, fromLip: true, bank: xlGoal.points[2] })).toEqual({ state: 'done', stars: 3 });
  });
});

describe('lock hints', () => {
  const a = { id: 'a', name: 'Air fork' }, b = { id: 'b', name: 'Wide bars' };
  it('a two-part hint buys only what is not owned', () => {
    expect(pairHint(a, b, () => false)).toBe('get the Air fork and Wide bars');
    expect(pairHint(a, b, () => true)).toBe('fit your Air fork and Wide bars');
    expect(pairHint(a, b, (x) => x.id === 'a')).toBe('get the Wide bars and fit your Air fork');
    expect(pairHint(a, b, (x) => x.id === 'b')).toBe('get the Air fork and fit your Wide bars');
  });
});
