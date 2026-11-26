// "Who's riding?": the two riders' names (tap ✎ to rename) and Ride!, which opens that rider's map. Bikes are picked
// in the Garage now, so there are no bike buttons here.
import './hub.css';
import { esc } from '../esc';
import { exportSave, loadGame, parseSave, saveGame, type Store } from '../progress';
import { bindPresses } from '../../input/press';


export function showWho(who: HTMLElement, store: Store, ride: (index: number) => void): void {
  let game = loadGame(store);
  const draw = () => {
    who.querySelector('.riders')!.innerHTML = game.riders
      .map(
        (p, i) => `
    <div class="rider" data-i="${i}">
      <div class="name"><b>${esc(p.name)}</b><button class="rename" aria-label="Change name">✎</button></div>
      <button class="go">Ride!</button>
    </div>`,
      )
      .join('');
  };
  draw();

  function rename(card: HTMLElement, i: number): void {
    const box = card.querySelector('.name')!;
    box.innerHTML = `<input maxlength="14" enterkeyhint="done" autocomplete="off" value="${esc(game.riders[i].name)}">`;
    const input = box.querySelector('input')!;
    input.focus();
    input.select();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      // re-read the save and change only this name: another tab may have saved since this page loaded
      const now = loadGame(store);
      if (name) now.riders[i] = { ...now.riders[i], name };
      saveGame(store, now);
      game = now;
      draw();
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && commit());
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
  }

  // Backup (for the grown-up): the save as text to copy out, and a box to paste one back in
  const backup = who.querySelector<HTMLElement>('.backup');
  if (backup) {
    const text = backup.querySelector('textarea')!;
    const note = backup.querySelector<HTMLElement>('.note')!;
    const say = (t: string) => (note.textContent = t);
    const open = () => {
      const show = backup.classList.toggle('show');
      if (show) {
        text.value = exportSave(store);
        say('');
      }
    };
    const copy = async () => {
      text.value = exportSave(store);
      text.select();
      try {
        await navigator.clipboard.writeText(text.value);
        say('Copied. Paste it somewhere safe, like Notes.');
      } catch {
        say('Select all and copy it by hand.'); // clipboard needs https or localhost
      }
    };
    const restore = () => {
      const g = parseSave(text.value);
      if (!g) return say("That doesn't look like a Shoshone Shredder save. Nothing changed.");
      if (!confirm(`Replace both riders (${g.riders[0].name} and ${g.riders[1].name}) with this save?`)) return;
      saveGame(store, g);
      game = g;
      draw();
      say('Restored.');
    };
    // buttons press as the finger lifts, even with another finger on the glass (see input/press.ts)
    bindPresses(backup, (b) => {
      if (b.classList.contains('open')) open();
      else if (b.classList.contains('copy')) void copy();
      else if (b.classList.contains('restore')) restore();
    });
  }

  // Back (or a swipe back) can restore this page from the back-forward cache still "loading": let taps work again, and
  // redraw from the save
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    who.classList.remove('loading');
    game = loadGame(store);
    draw();
  });

  bindPresses(who, (el) => {
    const card = el.closest<HTMLElement>('.rider');
    if (!card || who.classList.contains('loading')) return;
    const i = Number(card.dataset.i);
    if (el.classList.contains('rename')) rename(card, i);
    else if (el.classList.contains('go')) {
      who.classList.add('loading'); // one tap: a second one mid-load does nothing
      ride(i);
    }
  });
}
