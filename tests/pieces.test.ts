import { describe, it, expect } from 'vitest';
import { nameHtml, starHtml, COG, mergeNames, stripHtml, medalsHtml, stripKey, setText, setHidden } from '../src/game/pieces';

describe('pieces', () => {
  it('hill icons keep the arrow as text', () => {
    expect(nameHtml('Goat Ladder ↑')).toBe('Goat Ladder <i class="ui-hill up">↑</i>');
    expect(nameHtml('Hairpin Hollow ↕')).toContain('<i class="ui-hill both">↕</i>');
    expect(nameHtml('Clear Goat Ladder ↑ and ↓ first')).toBe('Clear Goat Ladder <i class="ui-hill up">↑</i> and <i class="ui-hill down">↓</i> first');
    expect(nameHtml('A & <B>')).toBe('A &#38; &#60;B&#62;');
  });
  it('stars and cog', () => {
    expect(starHtml(true)).toBe('<i class="ui-star won">★</i>');
    expect(starHtml(false)).toBe('<i class="ui-star">☆</i>');
    expect(COG).toBe('<i class="ui-cog">⚙</i>');
  });
  it('merged names share their first words', () => {
    expect(mergeNames(['Table Row Big', 'Table Row XL'])).toBe('Table Row Big · XL');
    expect(mergeNames(['Table Row Medium', 'The Pump House', 'The Plank'])).toBe('Table Row Medium · The Pump House · The Plank');
    expect(mergeNames(['Goat Ladder ↑'])).toBe('Goat Ladder ↑');
  });
  it('strip: next star as icons, gold on time and when full, values as CSS vars', () => {
    const h = stripHtml({ kind: 'points', next: 2, full: false, have: '1,200', fill: 0.5556, open: 0.2222, target: '1,500', red: false, left: null });
    expect(h).toContain('data-next="2"');
    expect(h).toContain('--fill:0.556');
    expect(h).toContain('--open:0.222');
    expect(h.match(/ui-star"/g)?.length).toBe(2);
    expect(h).toContain('<b class="have">1,200</b>');
    expect(h).toContain('<span class="target">1,500</span>');
    const t = stripHtml({ kind: 'time', next: 3, full: false, have: '0.0 s', fill: 1, open: 0, target: 'under 7.4', red: false, left: null });
    expect(t.match(/ui-star won/g)?.length).toBe(3);
  });
  it('a time star whose fuse is out is stone', () => {
    const h = stripHtml({ kind: 'time', next: 3, full: false, have: '15.1 s', fill: 0, open: 0, target: 'under 14.6', red: false, left: null });
    expect(h.match(/ui-star"/g)?.length).toBe(3);
  });
  it('medals: star, target, then pay with the cog or ✓ won', () => {
    const h = medalsHtml([
      { won: true, target: '150 points', pays: null },
      { won: false, target: '1,500 points', pays: 90 },
      { won: false, target: '2,700 points', pays: 150 },
    ]);
    expect(h.match(/class="ui-medal[ "]/g)?.length).toBe(3);
    expect(h).toContain('✓ won');
    expect(h).toContain(`+90 ${COG}`);
    expect(h).toContain('1,500 points');
  });
});

describe('strip change detection', () => {
  const base = { kind: 'points', next: 2, full: false, have: '1,200', fill: 0.5, open: 0.2, target: '1,500', red: false, left: null } as const;
  it('same key when nothing a viewer could see changed', () => {
    expect(stripKey({ ...base, fill: 0.5 + 1 / 2000 })).toBe(stripKey(base));
    expect(stripKey({ ...base, fill: 0.5 + 1 / 200 })).not.toBe(stripKey(base));
    expect(stripKey({ ...base, have: '1,201' })).not.toBe(stripKey(base));
    expect(stripKey({ ...base, red: true })).not.toBe(stripKey(base));
  });
  it('setText and setHidden write only on change', () => {
    let writes = 0, text = 'a', hidden = false;
    const el = { get textContent() { return text; }, set textContent(v: string) { writes++; text = v; }, get hidden() { return hidden; }, set hidden(v: boolean) { writes++; hidden = v; } };
    setText(el as unknown as Element, 'a'); setText(el as unknown as Element, 'b'); setText(el as unknown as Element, 'b');
    setHidden(el as unknown as HTMLElement, false); setHidden(el as unknown as HTMLElement, true);
    expect(writes).toBe(2 + 0);
  });
});
