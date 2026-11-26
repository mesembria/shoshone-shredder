// The pieces every screen shares: the wooden trail sign, the star and cog art, the hill icons after a name, the
// next-star strip and the star medals. The riding HUD, the 3-2-1, the ring card, the area lists and the result card
// all build from these, so a star or a sign looks and means the same everywhere.
// Every art piece keeps its glyph as text (★ won, ☆ not won, ⚙, ↑ ↓ ↕), drawn transparent over the picture, so screen
// readers and the checks' innerText still read it.
import './pieces.css';
import { esc } from './esc';
import type { Medal, Strip } from './targets';

const HILL = { '↑': 'up', '↓': 'down', '↕': 'both' } as const;

// A name (or any line naming challenges, like a lock) with every ↑ ↓ ↕ as its clay hill icon
export const nameHtml = (text: string): string => esc(text).replace(/[↑↓↕]/g, (a) => `<i class="ui-hill ${HILL[a as keyof typeof HILL]}">${a}</i>`);
export const starHtml = (won: boolean): string => (won ? '<i class="ui-star won">★</i>' : '<i class="ui-star">☆</i>');
export const COG = '<i class="ui-cog">⚙</i>';
// The sign: titleHtml is already HTML (from nameHtml), symHtml the area's trail symbol
export const signHtml = (titleHtml: string, symHtml = ''): string => `<div class="ui-sign"><span class="t">${symHtml ? `${symHtml} ` : ''}${titleHtml}</span></div>`;

// "Table Row Big", "Table Row XL" → "Table Row Big · XL"; names with nothing in common are just listed
export function mergeNames(names: string[]): string {
  const base = (n: string) => n.slice(0, n.lastIndexOf(' '));
  const b = base(names[0]);
  if (names.length > 1 && b && names.every((n) => base(n) === b)) return `${names[0]} · ${names.slice(1).map((n) => n.slice(b.length + 1)).join(' · ')}`;
  return names.join(' · ');
}

// ---- the next-star strip: [have] [bar] [next star] [target]
const n3 = (v: number) => String(Number(v.toFixed(3)));
// the star the bar is for: gold on a time goal while its fuse burns (you hold it until it runs out) and when all three
// are won
const nextStars = (s: Strip) => starHtml((s.kind === 'time' && s.fill > 0) || s.full).repeat(s.next);
const stripClass = (s: Strip) => `ui-strip ${s.kind}${s.red ? ' red' : ''}${s.full ? ' full' : ''}`;
export function stripHtml(s: Strip): string {
  return `<div class="${stripClass(s)}" data-next="${s.next}" style="--fill:${n3(s.fill)};--open:${n3(s.open)}"><b class="have">${s.have}</b><span class="bar"><i class="fill"></i><i class="open"></i></span><span class="next">${nextStars(s)}</span><span class="target">${s.target}</span></div>`;
}
// The same strip, updated in place each frame: the numbers and the bar every time, the star icons only when the next
// star changes. A star passed pops the stars. A fuse run out drops that one gold star: it stays a moment where it was,
// falling and fading (on the last star, over the empty one left behind), while the stars still held stay put.
const LOST = '<i class="ui-star won lost">★</i>', LOST_MS = 350;
// What the strip shows, as one string: the bar only has 240 px, so fill and open round to 1/240. The same string as
// last frame means there is nothing to write.
const q240 = (v: number) => Math.round(v * 240) / 240;
export const stripKey = (s: Strip): string => `${stripClass(s)}|${s.next}|${s.fill > 0 ? 1 : 0}|${q240(s.fill)}|${q240(s.open)}|${s.have}|${s.target}`;
// Text and hidden writes that skip when nothing changes (a write restyles the page even if the value is the same)
export const setText = (el: Element, text: string): void => { if (el.textContent !== text) el.textContent = text; };
export const setHidden = (el: HTMLElement, hidden: boolean): void => { if (el.hidden !== hidden) el.hidden = hidden; };
export function paintStrip(el: HTMLElement, s: Strip): void {
  const key = stripKey(s);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const before = Number(el.dataset.next), wasFull = el.classList.contains('full');
  el.className = stripClass(s);
  el.style.setProperty('--fill', n3(q240(s.fill)));
  el.style.setProperty('--open', n3(q240(s.open)));
  el.querySelector('.have')!.textContent = s.have;
  el.querySelector('.target')!.textContent = s.target;
  const wasGold = !!el.querySelector('.next .ui-star.won:not(.lost)'), gold = (s.kind === 'time' && s.fill > 0) || s.full;
  if (before === s.next && wasFull === s.full && wasGold === gold) return;
  el.dataset.next = String(s.next);
  const stars = el.querySelector<HTMLElement>('.next')!;
  stars.classList.remove('pop');
  if (s.kind === 'time') {
    // every star whose fuse ran out since the last paint (one, unless a frame skipped a whole tier), and the last star
    // going out with nothing after it
    const last = s.next === before && wasGold && !gold, lost = s.next < before ? before - s.next : last ? 1 : 0;
    stars.innerHTML = nextStars(s) + (last ? LOST.replace('lost', 'lost over') : LOST.repeat(lost));
    stars.querySelectorAll('.lost').forEach((g) => setTimeout(() => g.remove(), LOST_MS));
    return;
  }
  stars.innerHTML = nextStars(s);
  void stars.offsetWidth;
  if (s.next > before || s.full) stars.classList.add('pop');
}

// ---- the three star medals: the stars for that tier, what it needs, and what it pays or "✓ won"
export function medalsHtml(medals: Medal[]): string {
  return `<div class="ui-medals">${medals
    .map((m, i) => `<div class="ui-medal${m.won ? ' won' : ''}"><span class="s">${starHtml(m.won).repeat(i + 1)}</span><span class="tgt">${m.target}</span><span class="ui-pay">${m.won ? '✓ won' : m.pays !== null ? `+${m.pays} ${COG}` : ''}</span></div>`)
    .join('')}</div>`;
}
