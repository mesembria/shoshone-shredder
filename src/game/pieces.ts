// The pieces every screen shares: the wooden trail sign, the star and cog art, the hill icons after a name, the
// next-star strip and the star medals. The riding HUD, the 3-2-1, the ring card, the area lists and the result card
// all build from these, so a star or a sign looks and means the same everywhere.
// Every art piece keeps its glyph as text (★ won, ☆ not won, ⚙, ↑ ↓ ↕), drawn transparent over the picture, so screen
// readers and the checks' innerText still read it.
import './pieces.css';
import type { Medal, Strip } from './targets';

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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
// star changes (a star passed pops, a fuse run out drops the star)
export function paintStrip(el: HTMLElement, s: Strip): void {
  const before = Number(el.dataset.next), wasFull = el.classList.contains('full');
  el.className = stripClass(s);
  el.style.setProperty('--fill', n3(s.fill));
  el.style.setProperty('--open', n3(s.open));
  el.querySelector('.have')!.textContent = s.have;
  el.querySelector('.target')!.textContent = s.target;
  const wasGold = !!el.querySelector('.next .ui-star.won'), gold = (s.kind === 'time' && s.fill > 0) || s.full;
  if (before === s.next && wasFull === s.full && wasGold === gold) return;
  el.dataset.next = String(s.next);
  const stars = el.querySelector<HTMLElement>('.next')!;
  stars.innerHTML = nextStars(s);
  const anim = s.kind === 'time' ? 'drop' : 'pop';
  stars.classList.remove('pop', 'drop');
  void stars.offsetWidth;
  if (s.kind === 'time' ? s.next < before : s.next > before || s.full) stars.classList.add(anim);
}

// ---- the three star medals: the stars for that tier, what it needs, and what it pays or "✓ won"
export function medalsHtml(medals: Medal[]): string {
  return `<div class="ui-medals">${medals
    .map((m, i) => `<div class="ui-medal${m.won ? ' won' : ''}"><span class="s">${starHtml(m.won).repeat(i + 1)}</span><span class="tgt">${m.target}</span><span class="pay">${m.won ? '✓ won' : m.pays !== null ? `+${m.pays} ${COG}` : ''}</span></div>`)
    .join('')}</div>`;
}
