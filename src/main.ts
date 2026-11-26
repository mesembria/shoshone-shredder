// Start screen: pick a bike, then ride. The tap also unlocks sound on the iPad.
import './style.css';
import type { BikeId } from './rules/bikes';
import { createSound } from './view/sound';
import { startGame } from './game';
import { bindPresses } from './input/press';

const params = new URLSearchParams(location.search);
const picker = document.getElementById('picker')!;

bindPresses(picker, async (button) => {
  if (!button.dataset.bike) return;
  const sound = createSound();
  sound.unlock();
  picker.classList.add('loading');
  await startGame(document.getElementById('game') as HTMLCanvasElement, document.getElementById('hud')!, button.dataset.bike as BikeId, sound, {
    debug: params.has('debug'),
    autoLand: params.get('autoland') !== '0',
    start: params.get('start') === 'park' ? 'park' : 'home',
    timeScale: Number(params.get('slow')) || 1,
  });
  picker.remove();
});
