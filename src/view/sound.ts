// Every sound is made on the fly with Web Audio: no files to load, no voices.
import type { BikeState } from '../bike/controller';
import type { Surface } from '../world/physics';

// Tire sound per surface: band-passed noise. Pavement buzzes, dirt crunches, grass swishes (tall grass louder).
const TIRE: Record<Surface, { freq: number; q: number; level: number }> = {
  ground: { freq: 1400, q: 1.6, level: 0.16 },
  dirt: { freq: 600, q: 0.8, level: 0.3 },
  grass: { freq: 3200, q: 0.6, level: 0.14 },
  tallgrass: { freq: 2600, q: 0.5, level: 0.2 },
  ramp: { freq: 450, q: 2.5, level: 0.25 },
  wall: { freq: 800, q: 1.5, level: 0.2 },
  rail: { freq: 2200, q: 9, level: 0.12 },
  rock: { freq: 700, q: 1.8, level: 0.22 },
};
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // trick chimes climb a major pentatonic scale with each trick in a combo

export interface Sound {
  unlock(): void;
  update(s: BikeState): void;
  pop(): void;
  land(strength: number, surface: Surface): void;
  bottom(): void; // the suspension hits its bump stop: a hard clunk
  trick(count: number): void;
  bank(): void;
  crash(big: boolean): void;
  bump(): void;
  scrape(): void;
}

export function createSound(): Sound {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const layer = (type: BiquadFilterType, freq: number, q: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { filter, gain };
  };
  const tire = layer('bandpass', 1400, 1.6);
  const wind = layer('lowpass', 400, 0.7);
  const skid = layer('bandpass', 2600, 0.8); // the rear tire sliding
  const rattle = layer('bandpass', 650, 3); // a speed wobble: the bike shaking itself apart

  const tone = (freq: number, at: number, len: number, level: number, type: OscillatorType = 'sine', to?: number) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + len);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + len + 0.05);
  };
  const hiss = (at: number, len: number, level: number, freq: number, q = 1) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + len);
    src.connect(filter).connect(g).connect(master);
    src.start(at, Math.random());
    src.stop(at + len + 0.05);
  };
  const note = (semi: number) => 523.25 * Math.pow(2, semi / 12);

  return {
    unlock() {
      // iPad Safari starts audio only from a tap
      void ctx.resume();
    },
    update(s) {
      const now = ctx.currentTime;
      const speed = s.crash ? 0 : Math.min(1, s.speed / 10);
      const t = TIRE[s.surface];
      tire.gain.gain.setTargetAtTime(s.grounded && !s.crash ? t.level * speed : 0, now, 0.05);
      tire.filter.frequency.setTargetAtTime(t.freq * (0.7 + 0.5 * speed), now, 0.05);
      tire.filter.Q.setTargetAtTime(t.q, now, 0.1);
      wind.gain.gain.setTargetAtTime(0.35 * speed * speed + (s.grounded ? 0 : 0.08), now, 0.15);
      wind.filter.frequency.setTargetAtTime(300 + 900 * speed, now, 0.15);
      skid.gain.gain.setTargetAtTime(s.skidding ? 0.12 + 0.25 * speed : 0, now, 0.04);
      skid.filter.frequency.setTargetAtTime(s.surface === 'ground' ? 3000 : 1200, now, 0.05);
      const wobble = s.crash ? 0 : ((s as { wobble?: number }).wobble ?? 0);
      rattle.gain.gain.setTargetAtTime(wobble * 0.5 * (0.55 + 0.45 * Math.sin(now * 70)), now, 0.02);
    },
    pop() {
      tone(260, ctx.currentTime, 0.14, 0.25, 'triangle', 640);
    },
    land(strength, surface) {
      const now = ctx.currentTime;
      tone(110, now, 0.18 + 0.1 * strength, 0.35 * Math.min(1.5, strength + 0.3), 'sine', 55);
      hiss(now, 0.15 + 0.1 * strength, 0.25 * strength, TIRE[surface].freq, 0.8);
    },
    bottom() {
      const now = ctx.currentTime;
      tone(70, now, 0.14, 0.45, 'square', 38);
      tone(180, now, 0.05, 0.2, 'triangle', 90);
    },
    trick(count) {
      // count 0 (a trick that scored nothing) would read SCALE[-1]: a NaN note throws and stops the frame loop
      const now = ctx.currentTime, semi = SCALE[Math.min(SCALE.length - 1, Math.max(1, count) - 1)];
      tone(note(semi), now, 0.18, 0.18, 'triangle');
      tone(note(semi + 7), now + 0.07, 0.22, 0.14, 'triangle');
    },
    bank() {
      const now = ctx.currentTime;
      [0, 4, 7, 12].forEach((semi, i) => tone(note(semi), now + i * 0.07, 0.25, 0.16, 'square'));
    },
    crash(big) {
      const now = ctx.currentTime;
      hiss(now, 0.4, 0.5, 900, 0.5);
      tone(90, now, 0.35, 0.5, 'sine', 40);
      if (big) for (let i = 0; i < 5; i++) tone(note(24 + ((i * 5) % 12)), now + 0.25 + i * 0.09, 0.12, 0.08, 'sine');
    },
    bump() {
      tone(140, ctx.currentTime, 0.12, 0.3, 'sine', 70);
    },
    scrape() {
      hiss(ctx.currentTime, 0.12, 0.12, 1800, 1.5);
    },
  };
}
