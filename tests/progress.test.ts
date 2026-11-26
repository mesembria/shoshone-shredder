import { describe, it, expect } from 'vitest';
import { newProfile, loadGame, saveGame, loadoutOf, payFor, starPays, buyPart, buyBike, buyAndRideBike, fitPart, paint, rideBike, PAINTS, SAVE_KEY, PAY, exportSave, parseSave, type Profile } from '../src/game/progress';
import { PARTS, SHEETS, stockFitted } from '../src/game/catalog';
import { LAB_BIKES } from '../src/lab/bikes';

const rich = (cogs: number): Profile => ({ ...newProfile('Sam'), cogs });
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('a new rider', () => {
  it('has the hardtail, stock, 0 cogs', () => {
    const p = newProfile('Sam');
    expect(p).toMatchObject({ name: 'Sam', cogs: 0, riding: 'hardtail', stars: {}, paid: {} });
    expect(Object.keys(p.bikes)).toEqual(['hardtail']);
    expect(p.bikes.hardtail).toEqual({ parts: [], fitted: stockFitted('hardtail'), color: LAB_BIKES.hardtail.frameColor });
  });
});

describe('loading', () => {
  it('loads a v1 save as fresh riders with their names', () => {
    const store = memory();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 1, riders: [{ name: 'Sam', bolts: 900, parts: { frame: 2 }, stars: { slalom: 3 } }, { name: 'Max', bike: 'enduro' }] }));
    const g = loadGame(store);
    expect(g.version).toBe(2);
    expect(g.riders.map((r) => r.name)).toEqual(['Sam', 'Max']);
    for (const r of g.riders) {
      expect(r.cogs).toBe(0);
      expect(Object.keys(r.bikes)).toEqual(['hardtail']);
      expect(r.stars).toEqual({});
    }
    for (const junk of ['{not json', 'null', '[]', '']) {
      const s = memory();
      s.setItem(SAVE_KEY, junk);
      expect(loadGame(s).riders.map((r) => r.name)).toEqual(['Rider 1', 'Rider 2']);
    }
    expect(loadGame(memory()).riders).toHaveLength(2);
  });

  it('keeps a rider whose star counts were hand-edited badly, with each bad count made sensible', () => {
    const good = { ...newProfile('Ok'), cogs: 5.7 };
    const store = memory();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 2, riders: [{ ...good, stars: { a: 2, b: null, c: 9, d: -1, e: 1.5, f: 'x' }, paid: { a: null, b: 2 } }, good] }));
    const r = loadGame(store).riders[0];
    expect(r.stars).toEqual({ a: 2, c: 3, d: 0, e: 1 });
    expect(r.paid).toEqual({ b: 2 });
    expect(r.cogs).toBe(5);
    expect(payFor(r, 'b', 2).cogs).toBeGreaterThan(0);
    expect(Number.isFinite(payFor(r, 'z', 3).cogs)).toBe(true);
  });

  it('round-trips a v2 game', () => {
    const store = memory();
    const g = loadGame(store);
    g.riders[1] = { ...rich(77), name: 'Max', stars: { a: 2 }, paid: { a: 2 } };
    saveGame(store, g);
    expect(loadGame(store).riders[1]).toEqual(g.riders[1]);
  });

  it('falls back per rider when a v2 rider is malformed, keeping the name', () => {
    const good = { ...newProfile('Ok'), cogs: 5 };
    const store = memory();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 2, riders: [{ ...newProfile('Bad'), cogs: -3 }, good] }));
    let g = loadGame(store);
    expect(g.riders[0]).toEqual(newProfile('Bad'));
    expect(g.riders[1]).toEqual(good);
    for (const bad of [{ ...good, cogs: 'x' }, { ...good, cogs: NaN }, { ...good, bikes: { unicycle: good.bikes.hardtail } }, { ...good, riding: 'unicycle' }, { name: 'Z' }]) {
      store.setItem(SAVE_KEY, JSON.stringify({ version: 2, riders: [bad, good] }));
      g = loadGame(store);
      expect(g.riders[0].cogs).toBe(0);
      expect(Object.keys(g.riders[0].bikes)).toEqual(['hardtail']);
    }
    store.setItem(SAVE_KEY, JSON.stringify({ version: 2 }));
    expect(loadGame(store).riders).toHaveLength(2);
  });

  it('a loaded save riding an unowned bike rides the hardtail', () => {
    const store = memory();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 2, riders: [{ ...newProfile('Sam'), riding: 'enduro' }] }));
    const g = loadGame(store);
    expect(g.riders[0].riding).toBe('hardtail');
    expect(g.riders[0].name).toBe('Sam');
    expect(g.riders[0].bikes.hardtail).toBeDefined();
  });

  it('keeps unknown parts through a save', () => {
    const p = rich(0);
    p.bikes.hardtail!.parts = ['retiredFork'];
    const store = memory();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 2, riders: [p] }));
    const g = loadGame(store);
    expect(g.riders[0].bikes.hardtail!.parts).toEqual(['retiredFork']);
    const out = memory();
    saveGame(out, g);
    expect(loadGame(out).riders[0].bikes.hardtail!.parts).toEqual(['retiredFork']);
    expect(loadoutOf(g.riders[0]).fitted).toEqual(stockFitted('hardtail'));
  });
});

describe('loadouts', () => {
  it('a broken loadout falls back to stock', () => {
    const p: Profile = { ...newProfile('Sam'), riding: 'enduro' };
    expect(loadoutOf(p).bike).toBe('hardtail');
    const q = newProfile('Sam');
    q.bikes.hardtail!.fitted = { ...q.bikes.hardtail!.fitted, tires: 'hardtail-sticky-tires', brakes: 'nope', suspension: 'enduro-air' };
    const l = loadoutOf(q); // sticky tires not owned
    expect(l.fitted).toEqual(stockFitted('hardtail'));
    q.bikes.hardtail!.parts = ['hardtail-sticky-tires'];
    expect(loadoutOf(q).fitted.tires).toBe('hardtail-sticky-tires');
    expect(loadoutOf(q).fitted.brakes).toBe(stockFitted('hardtail').brakes);
  });

  it('uses the bike color and an owned bike on request', () => {
    const p = { ...rich(9999) };
    const b = buyBike(p, 'enduro')!;
    expect(loadoutOf(b, 'enduro').bike).toBe('enduro');
    expect(loadoutOf(b, 'bolinas').bike).toBe('hardtail');
    expect(loadoutOf(b, 'enduro').spec.frameColor).toBe(LAB_BIKES.enduro.frameColor);
  });
});

describe('pay', () => {
  // the plan's pay: 1★ 20, 2★ 45, 3★ 110, a repeat a fifth of 1★ (tests/pacing.test.ts checks prices against it)
  it('keeps the planned pay tiers', () => {
    expect(PAY).toEqual({ tiers: [20, 45, 110], repeatShare: 0.2 });
  });

  it('pays each new star once, a little for repeats', () => {
    const [one, two, three] = PAY.tiers, repeat = Math.round(one * PAY.repeatShare);
    const a = payFor(newProfile('Sam'), 'c', 1);
    expect(a.cogs).toBe(one);
    expect(a.newStars).toBe(1);
    const b = payFor(a.profile, 'c', 3);
    expect(b.cogs).toBe(two + three);
    expect(b.profile.cogs).toBe(one + two + three);
    expect(b.profile.stars.c).toBe(3);
    const c = payFor(b.profile, 'c', 3);
    expect(c.cogs).toBe(repeat);
    expect(c.cogs).toBeGreaterThan(0);
    expect(c.newStars).toBe(0);
    expect(payFor(newProfile('Sam'), 'd', 3).cogs).toBe(one + two + three);
    expect(c.profile.paid.c).toBe(3);
  });

  it('starPays prices each star still to win, so earning several at once pays what the list shows', () => {
    let p = newProfile('Sam');
    expect(starPays(p, 'c')).toEqual({ have: 0, left: PAY.tiers, repeat: 0 });
    // from 0 stars, a 2-star run pays the first two prices together
    expect(payFor(p, 'c', 2).cogs).toBe(starPays(p, 'c').left[0] + starPays(p, 'c').left[1]);
    for (let had = 0; had < 3; had++) {
      for (let to = had + 1; to <= 3; to++) expect(payFor(p, 'c', to).cogs).toBe(starPays(p, 'c').left.slice(0, to - had).reduce((a, b) => a + b, 0));
      p = payFor(p, 'c', had + 1).profile;
      expect(starPays(p, 'c').have).toBe(had + 1);
    }
    // all three won: nothing left, a replay pays the repeat share
    expect(starPays(p, 'c')).toEqual({ have: 3, left: [], repeat: payFor(p, 'c', 3).cogs });
    expect(starPays(p, 'c').repeat).toBe(Math.round(PAY.tiers[0] * PAY.repeatShare));
  });

  it('pays nothing for a failed run and never lowers a best', () => {
    const p = payFor(newProfile('Sam'), 'c', 3).profile;
    const f = payFor(p, 'c', 0);
    expect(f.cogs).toBe(0);
    expect(f.profile).toEqual(p);
    expect(payFor(p, 'c', 1).profile.stars.c).toBe(3);
  });
});

describe('buying', () => {
  it('is idempotent and never overdraws', () => {
    const price = PARTS.find((x) => x.id === 'hardtail-sticky-tires')!.price;
    const short = rich(price - 1);
    expect(buyPart(short, 'hardtail-sticky-tires')).toBeNull();
    const p = rich(price + 3);
    const snapshot = JSON.stringify(p);
    const once = buyPart(p, 'hardtail-sticky-tires')!;
    expect(JSON.stringify(p)).toBe(snapshot); // input untouched
    expect(once.cogs).toBe(3);
    expect(once.bikes.hardtail!.parts).toEqual(['hardtail-sticky-tires']);
    expect(buyPart(once, 'hardtail-sticky-tires')).toBeNull();
    expect(once.cogs).toBe(3);
    expect(buyPart(rich(9999), 'enduro-air-fork')).toBeNull(); // bike not owned (or no such part)
    expect(buyPart(rich(9999), 'hardtail-suspension-stock')).toBeNull();
    expect(buyPart(rich(9999), 'nope')).toBeNull();
  });

  it('buys a part for an unowned bike only after buying the bike', () => {
    const enduroPart = 'enduro-suspension-stock';
    expect(buyPart(rich(9999), enduroPart)).toBeNull();
    expect(buyBike(rich(SHEETS.enduro.price - 1), 'enduro')).toBeNull();
    const p = rich(1000);
    const snap = JSON.stringify(p);
    const e = buyBike(p, 'bolinas')!;
    expect(JSON.stringify(p)).toBe(snap);
    expect(e.cogs).toBe(1000 - SHEETS.bolinas.price);
    expect(e.bikes.bolinas).toMatchObject({ parts: [], fitted: stockFitted('bolinas'), color: LAB_BIKES.bolinas.frameColor });
    expect(buyBike(e, 'bolinas')).toBeNull();
    expect(buyBike(e, 'hardtail')).toBeNull();
  });

  it('buying a bike also rides it; a refused buy changes nothing', () => {
    const e = buyAndRideBike(rich(1000), 'bolinas')!;
    expect(e.riding).toBe('bolinas');
    expect(e.cogs).toBe(1000 - SHEETS.bolinas.price);
    expect(buyAndRideBike(e, 'bolinas')).toBeNull(); // a double tap doesn't charge twice
    expect(buyAndRideBike(rich(SHEETS.enduro.price - 1), 'enduro')).toBeNull();
  });

  it('locks parts to their bike', () => {
    const p = buyBike(rich(9999), 'enduro')!;
    expect(fitPart(p, 'hardtail-sticky-tires')).toBeNull();
    const q = buyPart(rich(100), 'hardtail-sticky-tires')!;
    expect(fitPart(q, 'enduro-whatever')).toBeNull();
    const fit = fitPart(q, 'hardtail-sticky-tires')!;
    expect(fit.bikes.hardtail!.fitted.tires).toBe('hardtail-sticky-tires');
    expect(fitPart(rich(100), 'hardtail-sticky-tires')).toBeNull(); // not owned
    expect(fitPart(fit, 'hardtail-tires-stock')?.bikes.hardtail!.fitted.tires).toBe('hardtail-tires-stock');
  });
});

describe('paint and ride', () => {
  it('accepts a basic color or the bike own color, nothing else', () => {
    expect(PAINTS).toHaveLength(8);
    const p = rich(0);
    expect(paint(p, 'hardtail', PAINTS[3])!.bikes.hardtail!.color).toBe(PAINTS[3]);
    expect(paint(p, 'hardtail', LAB_BIKES.hardtail.frameColor)).not.toBeNull();
    expect(paint(p, 'hardtail', LAB_BIKES.enduro.frameColor === PAINTS[0] ? 1 : 0x123456)).toBeNull();
    expect(paint(p, 'enduro', PAINTS[0])).toBeNull(); // not owned
    expect(p.bikes.hardtail!.color).toBe(LAB_BIKES.hardtail.frameColor);
  });

  it('rides only owned bikes', () => {
    const p = rich(0);
    expect(rideBike(p, 'enduro')).toBeNull();
    const e = buyBike(rich(9999), 'enduro')!;
    expect(rideBike(e, 'enduro')!.riding).toBe('enduro');
    expect(e.riding).toBe('hardtail');
  });
});

describe('backup text', () => {
  it('round-trips a save through exportSave and parseSave', () => {
    const store = memory();
    const g = loadGame(store);
    g.riders[0] = { ...rich(310), name: 'Sam', stars: { a: 3 }, paid: { a: 3 } };
    saveGame(store, g);
    expect(parseSave(exportSave(store))).toEqual(g);
    expect(parseSave(`  ${exportSave(store)}\n`)).toEqual(g);
  });

  it('refuses anything that is not a whole v2 save', () => {
    const ok = { version: 2, riders: [newProfile('A'), newProfile('B')] };
    expect(parseSave(JSON.stringify(ok))).toEqual(ok);
    const bad = [
      '', '{not json', 'null', '[]', '"x"',
      JSON.stringify({ ...ok, version: 1 }),
      JSON.stringify({ version: 2, riders: [newProfile('A')] }),
      JSON.stringify({ version: 2, riders: [newProfile('A'), { ...newProfile('B'), cogs: -1 }] }),
      JSON.stringify({ version: 2, riders: [newProfile('A'), null] }),
    ];
    for (const b of bad) expect(parseSave(b)).toBeNull();
  });
});
