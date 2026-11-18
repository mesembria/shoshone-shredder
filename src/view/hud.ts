// Score, combo, callouts, the dazed overlay, the Again button and the thumb rings. Plain DOM over the canvas.
import type { BikeState } from '../bike/controller';
import type { Combo } from '../rules/tricks';
import type { Outcome } from '../rules/crash';
import type { Thumb } from '../input/controls';

export function comboLine(names: string[], combo: Combo): string {
  if (combo.count === 0) return '';
  // the multiplied total too (what comboTotal banks), so a kid sees what the × does
  const mult = combo.count > 1 ? ` ×${combo.count} = ${Math.round(combo.points * combo.count)}` : '';
  return `${names.join(' + ')}  ${Math.round(combo.points)}${mult}`;
}

export interface Callout { text: string; sub?: string; tone: 'good' | 'meh' | 'bad' }

export function calloutFor(outcome: Outcome | 'bump'): Callout {
  switch (outcome) {
    case 'clean': return { text: 'Clean!', tone: 'good' };
    case 'bobble': return { text: 'Bobble', tone: 'meh' };
    case 'wipeout': return { text: 'Wipeout!', tone: 'bad' };
    case 'big': return { text: 'Big crash!', sub: 'Seeing stars · Winded', tone: 'bad' };
    case 'bump': return { text: 'Bonk!', tone: 'meh' };
  }
}

export interface DebugInfo { fps: number; calls: number; triangles: number; ratio: number }
export interface Hud {
  trick(names: string[], combo: Combo): void;
  callout(c: Callout): void;
  bank(points: number, total: number): void;
  update(s: BikeState, thumbs: { left: Thumb | null; right: Thumb | null }): void;
  debug(info: DebugInfo): void;
}

export function createHud(root: HTMLElement, onAgain: () => void, showDebug: boolean): Hud {
  root.innerHTML = `
    <div class="dazed"></div>
    <div class="score">0</div>
    <div class="combo"></div>
    <div class="callout"><b></b><small></small></div>
    <div class="bank"></div>
    <div class="thumb left"></div><div class="thumb right"></div>
    <button class="again" type="button">↻ Again</button>
    <pre class="debug"></pre>`;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const score = $('.score'), combo = $('.combo'), callout = $('.callout'), bank = $('.bank');
  const dazed = $('.dazed'), again = $<HTMLButtonElement>('.again'), dbg = $('.debug');
  const thumbL = $('.thumb.left'), thumbR = $('.thumb.right');
  again.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    onAgain();
  });
  dbg.hidden = !showDebug;
  // restart a CSS animation by removing and re-adding its class
  const pop = (el: HTMLElement, cls: string) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const placeThumb = (el: HTMLElement, t: Thumb | null) => {
    el.style.opacity = t ? '1' : '0';
    if (t) el.style.transform = `translate(${t.x0}px, ${t.y0}px)`;
  };
  return {
    trick(names, c) {
      combo.textContent = comboLine(names, c);
      pop(combo, 'pop');
    },
    callout(c) {
      callout.querySelector('b')!.textContent = c.text;
      callout.querySelector('small')!.textContent = c.sub ?? '';
      callout.dataset.tone = c.tone;
      pop(callout, 'show');
    },
    bank(points, total) {
      bank.textContent = `+${Math.round(points)}`;
      pop(bank, 'fly');
      score.textContent = Math.round(total).toLocaleString();
      combo.textContent = '';
    },
    update(s, thumbs) {
      if (s.combo.count === 0 && combo.textContent) combo.textContent = ''; // a crash drops the combo
      dazed.style.opacity = String(Math.min(1, s.stars / 1.5) * 0.85);
      again.classList.toggle('on', s.crash !== null);
      placeThumb(thumbL, thumbs.left);
      placeThumb(thumbR, thumbs.right);
    },
    debug(i) {
      if (showDebug) dbg.textContent = `${i.fps.toFixed(0)} fps · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · ${i.ratio.toFixed(2)}x`;
    },
  };
}
