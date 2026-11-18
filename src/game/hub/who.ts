// "Who's riding?": the two riders' names (tap ✎ to rename) and Ride!, which opens that rider's map. Bikes are picked
// in the Garage now, so there are no bike buttons here.
import './hub.css';
import { exportSave, loadGame, parseSave, saveGame, type Store } from '../progress';

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
      if (name) game.riders[i] = { ...game.riders[i], name };
      saveGame(store, game);
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
    backup.querySelector('.open')!.addEventListener('click', () => {
      const show = backup.classList.toggle('show');
      if (show) {
        text.value = exportSave(store);
        say('');
      }
    });
    backup.querySelector('.copy')!.addEventListener('click', async () => {
      text.value = exportSave(store);
      text.select();
      try {
        await navigator.clipboard.writeText(text.value);
        say('Copied. Paste it somewhere safe, like Notes.');
      } catch {
        say('Select all and copy it by hand.'); // clipboard needs https or localhost
      }
    });
    backup.querySelector('.restore')!.addEventListener('click', () => {
      const g = parseSave(text.value);
      if (!g) return say("That doesn't look like a Shoshone Shredder save. Nothing changed.");
      if (!confirm(`Replace both riders (${g.riders[0].name} and ${g.riders[1].name}) with this save?`)) return;
      saveGame(store, g);
      game = g;
      draw();
      say('Restored.');
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

  who.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const card = el.closest<HTMLElement>('.rider');
    if (!card || who.classList.contains('loading')) return;
    const i = Number(card.dataset.i);
    if (el.closest('.rename')) rename(card, i);
    else if (el.closest('.go')) {
      who.classList.add('loading'); // one tap: a second one mid-load does nothing
      ride(i);
    }
  });
}
