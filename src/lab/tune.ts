// Feel lab tuning: every number the lab bike, camera and assists read, live, plus the panel that edits them.
// Values persist in localStorage so a reload keeps your tuning. "Copy" puts them on the clipboard as JSON.

export const DEFAULTS = {
  // speed
  cruise: 6, sprint: 11, pedalAccel: 5, brake: 9, slopeG: 9.8, maxSpeed: 16, rolling: 0.15, grassDrag: 0.6, tallGrassDrag: 1.8, airDrag: 0.004, pump: 8,
  // turning
  grip: 9, minRadius: 1.5, pivot: 1.2, scrub: 1.5, skidDecel: 4, autoCorner: 0.4, steerResponse: 14, steerExpo: 1.4, airSteer: 1.3,
  // thumb stick
  stickRange: 70, stickArc: 0.4, stickFollow: 1, stickFixed: 1,
  // line assist
  assist: 0.7, assistReach: 9, assistAngle: 30,
  // jumps
  gUp: 13, gFloat: 9, floatBand: 1.6, gDown: 17, hopTap: 4.2, hopFull: 6, lipPop: 0.45, perfectWindow: 0.15, perfectBonus: 1.3,
  popBuffer: 0.35, stick: 1.5, landBoost: 1, landPull: 0.8, flatKeep: 0.85, airPitch: 0,
  // pump track and tricks
  pumpCost: 0.5, trackPedal: 0, coastFloor: 3, bermGrip: 1, spinTime: 0.7, flipTime: 0.85,
  legs: 4.1, steadyLegs: 0.7, dabSpeed: 1, dabTime: 0.9, looseMin: 0.15, looseLimit: 0.6, looseDrag: 0.8, spinPower: 0.6, rollUp: 0.15, hopPush: 1.8,
  // energy (shared by every bike; energyTank 0 turns energy off)
  energyTank: 10, energyRefill: 0.12, energyRest: 1.5, energyClimb: 2, energySteady: 0.8, burntUntil: 0.5, burntSlope: 0.05, burntStop: 2.5, burntRest: 2,
  // bike rules (each bike sets its own; 0 turns a rule off)
  energyCost: 1, gearTop: 0, gearBog: 0, wobbleSpeed: 0, wobbleKick: 0, wobbleGain: 1.5, wobbleLimit: 1, popSoak: 0, plowSize: 0, trickBoost: 0, trickBoostTime: 0.6,
  // walls
  wallCrash: 8, wallBig: 11, rockCrash: 5, bonkCos: 0.92, slideEase: 8,
  // suspension, the look (src/bike/springs.ts): spring feel, how far each thing moves it, how much squash the rider keeps
  suspStiff: 160, suspDamp: 14, suspLand: 1, suspChatter: 1, suspPump: 1, suspDive: 1, suspManual: 1, suspScale: 1, squashShare: 0.4, labRear: 0,
  // camera and speed cues
  camBack: 4.6, camUp: 2.0, camAhead: 4, camYaw: 5, fovBase: 52, fovFast: 74, shake: 0.04, speedLines: 1,
};
export type TuneKey = keyof typeof DEFAULTS;
export const T: Record<TuneKey, number> = { ...DEFAULTS };

interface Row { key: TuneKey; label: string; min: number; max: number; step: number }
const GROUPS: { name: string; rows: Row[] }[] = [
  { name: 'Speed', rows: [
    { key: 'cruise', label: 'Cruise, stick centered (m/s)', min: 3, max: 10, step: 0.1 },
    { key: 'sprint', label: 'Sprint, stick up (m/s; always 2.5 over cruise)', min: 5, max: 14, step: 0.1 },
    { key: 'pedalAccel', label: 'Pedal pickup', min: 1, max: 12, step: 0.5 },
    { key: 'brake', label: 'Brakes', min: 2, max: 20, step: 0.5 },
    { key: 'slopeG', label: 'Hill gravity (0 = hills do nothing)', min: 0, max: 20, step: 0.2 },
    { key: 'maxSpeed', label: 'Top speed from hills (m/s)', min: 8, max: 25, step: 0.5 },
    { key: 'rolling', label: 'Rolling drag', min: 0, max: 1, step: 0.05 },
    { key: 'grassDrag', label: 'Extra drag on grass', min: 0, max: 2, step: 0.05 },
    { key: 'tallGrassDrag', label: 'Extra drag in tall grass (trail edges)', min: 0, max: 5, step: 0.05 },
    { key: 'airDrag', label: 'Wind drag', min: 0, max: 0.02, step: 0.001 },
  ] },
  { name: 'Turning', rows: [
    { key: 'grip', label: 'Grip: how hard you can turn fast', min: 3, max: 20, step: 0.5 },
    { key: 'minRadius', label: 'Tightest turn when slow (m)', min: 0.5, max: 4, step: 0.1 },
    { key: 'pivot', label: 'Pivot at walking speed', min: 0, max: 3, step: 0.1 },
    { key: 'scrub', label: 'Pull back + steer: how much tighter', min: 0, max: 4, step: 0.1 },
    { key: 'skidDecel', label: 'Skid slows you', min: 0, max: 10, step: 0.5 },
    { key: 'autoCorner', label: 'Full steer slows you (0 = off)', min: 0, max: 1, step: 0.05 },
    { key: 'steerResponse', label: 'Steer response (higher = snappier)', min: 3, max: 40, step: 1 },
    { key: 'steerExpo', label: 'Fine steering near center', min: 1, max: 2.5, step: 0.05 },
    { key: 'airSteer', label: 'Air steering', min: 0, max: 3, step: 0.1 },
  ] },
  { name: 'Thumb stick', rows: [
    { key: 'stickRange', label: 'Thumb travel for full (px)', min: 40, max: 140, step: 5 },
    { key: 'stickArc', label: 'Ignore up/down while steering', min: 0, max: 1, step: 0.05 },
    { key: 'stickFollow', label: 'Stick follows thumb (1 = on)', min: 0, max: 1, step: 1 },
    { key: 'stickFixed', label: 'Stick stays put on the left (1 = on)', min: 0, max: 1, step: 1 },
  ] },
  { name: 'Line assist', rows: [
    { key: 'assist', label: 'Pull onto highlighted lines (0 = off)', min: 0, max: 1, step: 0.05 },
    { key: 'assistReach', label: 'Starts this far out (m)', min: 3, max: 20, step: 0.5 },
    { key: 'assistAngle', label: 'Catches within this angle (°)', min: 10, max: 60, step: 1 },
  ] },
  { name: 'Jumps', rows: [
    { key: 'gUp', label: 'Gravity going up', min: 6, max: 25, step: 0.5 },
    { key: 'gFloat', label: 'Gravity at the top (float)', min: 2, max: 20, step: 0.5 },
    { key: 'floatBand', label: 'Float zone size', min: 0, max: 4, step: 0.1 },
    { key: 'gDown', label: 'Gravity coming down', min: 6, max: 30, step: 0.5 },
    { key: 'hopTap', label: 'Hop, quick tap', min: 2, max: 8, step: 0.1 },
    { key: 'hopFull', label: 'Hop, full hold', min: 3, max: 10, step: 0.1 },
    { key: 'lipPop', label: 'Pop off a lip (share of hop)', min: 0, max: 1.5, step: 0.05 },
    { key: 'perfectWindow', label: 'Perfect pop window (s)', min: 0.05, max: 0.4, step: 0.01 },
    { key: 'perfectBonus', label: 'Perfect pop bonus', min: 1, max: 2, step: 0.05 },
    { key: 'popBuffer', label: 'Early pop memory (s)', min: 0, max: 0.6, step: 0.05 },
    { key: 'stick', label: 'Stick to ground over crests', min: 1, max: 3, step: 0.05 },
    { key: 'landBoost', label: 'Speed from landing slopes', min: 0, max: 2, step: 0.05 },
    { key: 'landPull', label: 'Pull toward the landing (0 = off)', min: 0, max: 1, step: 0.05 },
    { key: 'flatKeep', label: 'Speed kept on a flat landing', min: 0.5, max: 1, step: 0.05 },
    { key: 'airPitch', label: 'Stick tips the nose in the air', min: 0, max: 3, step: 0.1 },
  ] },
  { name: 'Pump track and tricks', rows: [
    { key: 'pump', label: 'Pump: speed from pressing on downhills', min: 0, max: 20, step: 0.5 },
    { key: 'pumpCost', label: 'Pump: cost of pressing on uphills', min: 0, max: 1.5, step: 0.05 },
    { key: 'trackPedal', label: 'Pedaling on the pump track (0 = off)', min: 0, max: 1, step: 1 },
    { key: 'coastFloor', label: 'Slowest you roll without pedaling (m/s)', min: 0, max: 6, step: 0.25 },
    { key: 'bermGrip', label: 'Extra grip from banked turns', min: 0, max: 2, step: 0.05 },
    { key: 'spinTime', label: '360 takes (s)', min: 0.3, max: 1.5, step: 0.05 },
    { key: 'flipTime', label: 'Backflip takes (s)', min: 0.4, max: 1.8, step: 0.05 },
  ] },
  { name: 'Climbs (try-out)', rows: [
    { key: 'legs', label: 'Leg power (higher climbs faster)', min: 1, max: 10, step: 0.1 },
    { key: 'steadyLegs', label: 'Share of power without pushing the stick up', min: 0.3, max: 1, step: 0.05 },
    { key: 'dabSpeed', label: 'Foot goes down below (m/s)', min: 0, max: 2, step: 0.05 },
    { key: 'dabTime', label: 'Foot down for (s)', min: 0.2, max: 2.5, step: 0.1 },
    { key: 'looseMin', label: 'Gravel: needs at least this much stick', min: 0, max: 1, step: 0.05 },
    { key: 'looseLimit', label: 'Gravel: wheel spins above this much stick', min: 0, max: 1, step: 0.05 },
    { key: 'looseDrag', label: 'Gravel: extra drag', min: 0, max: 3, step: 0.1 },
    { key: 'spinPower', label: 'Gravel: share of power left while spinning', min: 0, max: 1, step: 0.05 },
    { key: 'rollUp', label: 'Tallest step the front wheel rolls up (m)', min: 0.05, max: 0.5, step: 0.01 },
    { key: 'hopPush', label: 'Push from a standstill hop (m/s)', min: 0, max: 4, step: 0.1 },
  ] },
  { name: 'Bike rules', rows: [
    { key: 'energyCost', label: 'Energy cost (higher = tires sooner)', min: 0.3, max: 2, step: 0.05 },
    { key: 'gearTop', label: 'One gear: pedaling stops helping above (m/s; 0 = gears)', min: 0, max: 14, step: 0.1 },
    { key: 'gearBog', label: 'One gear: steep pitches cost extra', min: 0, max: 3, step: 0.1 },
    { key: 'trickBoost', label: 'Downhill: landed trick gives a burst of (m/s; 0 = off)', min: 0, max: 8, step: 0.1 },
    { key: 'trickBoostTime', label: 'Downhill: burst lasts (s)', min: 0.2, max: 2, step: 0.05 },
    { key: 'wobbleSpeed', label: 'Speed wobble starts above (m/s; 0 = never)', min: 0, max: 25, step: 0.5 },
    { key: 'wobbleKick', label: 'Wobble: how hard bumps kick', min: 0, max: 2, step: 0.05 },
    { key: 'wobbleGain', label: 'Wobble: steering gets touchier', min: 0, max: 4, step: 0.1 },
    { key: 'wobbleLimit', label: 'Wobble: wipeout at', min: 0.2, max: 3, step: 0.05 },
    { key: 'popSoak', label: 'Suspension soaks a lazy pop (share lost)', min: 0, max: 0.9, step: 0.05 },
    { key: 'plowSize', label: 'Rides over rocks smaller than (m)', min: 0, max: 0.6, step: 0.01 },
  ] },
  { name: 'Energy', rows: [
    { key: 'energyTank', label: 'Tank: seconds of sprint on the flat (0 = off)', min: 0, max: 30, step: 0.5 },
    { key: 'energyRefill', label: 'Refill while coasting (tank per s)', min: 0.02, max: 0.5, step: 0.01 },
    { key: 'energyRest', label: 'Refill when stopped (times faster)', min: 1, max: 4, step: 0.1 },
    { key: 'energyClimb', label: 'Climbs cost extra', min: 0, max: 15, step: 0.5 },
    { key: 'energySteady', label: 'Effort you can keep up forever', min: 0.2, max: 1.5, step: 0.05 },
    { key: 'burntUntil', label: 'Burnt until the tank is back to', min: 0.1, max: 0.8, step: 0.01 },
    { key: 'burntSlope', label: 'Burnt on a slope this steep: foot down (rad)', min: 0, max: 0.3, step: 0.01 },
    { key: 'burntStop', label: 'Burnt on a slope: foot down once slower than (m/s)', min: 0, max: 6, step: 0.1 },
    { key: 'burntRest', label: 'Burnt foot down lasts at most (s)', min: 0.5, max: 5, step: 0.1 },
  ] },
  { name: 'Walls', rows: [
    { key: 'wallCrash', label: 'Wipeout above (m/s into wall)', min: 4, max: 20, step: 0.5 },
    { key: 'rockCrash', label: 'Wipeout above (m/s into a rock or log)', min: 2, max: 20, step: 0.5 },
    { key: 'wallBig', label: 'Big crash above (m/s into wall)', min: 6, max: 25, step: 0.5 },
    { key: 'bonkCos', label: 'Head-on bonk (1 = only dead straight)', min: 0.6, max: 1, step: 0.01 },
    { key: 'slideEase', label: 'Turn along a wall you scrape', min: 1, max: 30, step: 1 },
  ] },
  { name: 'Suspension', rows: [
    { key: 'suspStiff', label: 'Look: spring stiffness', min: 40, max: 400, step: 5 },
    { key: 'suspDamp', label: 'Look: spring damping', min: 2, max: 40, step: 0.5 },
    { key: 'suspLand', label: 'Look: landings squish it', min: 0, max: 2, step: 0.05 },
    { key: 'suspChatter', label: 'Look: rough ground chatter', min: 0, max: 3, step: 0.05 },
    { key: 'suspPump', label: 'Look: pumping squish', min: 0, max: 2, step: 0.05 },
    { key: 'suspDive', label: 'Look: fork dives when braking', min: 0, max: 2, step: 0.05 },
    { key: 'suspManual', label: 'Look: manual stretches the fork', min: 0, max: 2, step: 0.05 },
    { key: 'suspScale', label: 'Look: drawn travel (1 = 0.8 × real)', min: 0.3, max: 2, step: 0.05 },
    { key: 'squashShare', label: 'Look: rider squash kept on a long-travel bike', min: 0, max: 1, step: 0.05 },
    { key: 'labRear', label: 'Rear design (Enduro): 0 its own, 1 single pivot, 2 linkage, 3 short link', min: 0, max: 3, step: 1 },
  ] },
  { name: 'Camera and speed', rows: [
    { key: 'camBack', label: 'Camera distance', min: 2, max: 10, step: 0.1 },
    { key: 'camUp', label: 'Camera height', min: 0.8, max: 6, step: 0.1 },
    { key: 'camAhead', label: 'Look ahead', min: 0, max: 10, step: 0.5 },
    { key: 'camYaw', label: 'Camera follows turns', min: 1, max: 20, step: 0.5 },
    { key: 'fovBase', label: 'View width, slow', min: 35, max: 80, step: 1 },
    { key: 'fovFast', label: 'View width, fast', min: 35, max: 100, step: 1 },
    { key: 'shake', label: 'Shake at speed', min: 0, max: 0.2, step: 0.01 },
    { key: 'speedLines', label: 'Speed lines', min: 0, max: 1, step: 0.05 },
  ] },
];

const STORE = 'shredder-lab-tune';

export function loadTune(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Record<TuneKey, number>>;
    for (const k of Object.keys(DEFAULTS) as TuneKey[]) if (typeof saved[k] === 'number') T[k] = saved[k]!;
  } catch {
    // a bad save just means defaults
  }
}
const save = () => localStorage.setItem(STORE, JSON.stringify(T));

const decimals = (step: number) => (step >= 1 ? 0 : String(step).split('.')[1]?.length ?? 0);

// The panel: a drawer on the right. Open pauses the ride. Station buttons teleport.
// Safari has no clipboard API on plain-http pages, which is how the iPad reaches the dev server, so fall back to
// selecting a hidden text box and the old copy command. Must run inside the button's tap.
function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => false);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '12pt' });
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return Promise.resolve(ok);
}

export function createPanel(root: HTMLElement, stations: string[], on: { open(open: boolean): void; go(station: string): void; reset(): void; change?(key: TuneKey): void }): { toggle(): void; refresh(): void } {
  const toggle = document.createElement('button');
  toggle.className = 'tune-toggle';
  toggle.textContent = '⚙ Tune';
  const drawer = document.createElement('div');
  drawer.className = 'tune';
  drawer.hidden = true;
  root.append(toggle, drawer);

  const head = document.createElement('div');
  head.className = 'tune-head';
  head.innerHTML = `<b>Feel lab</b><span><button data-act="copy">Copy</button><button data-act="reset">Reset</button><button data-act="close">Ride ▶</button></span>`;
  const go = document.createElement('div');
  go.className = 'tune-go';
  for (const s of stations) {
    const b = document.createElement('button');
    b.textContent = s;
    b.dataset.go = s;
    go.append(b);
  }
  // the changed values as text, so they can be read or screenshotted when copying isn't possible
  const out = document.createElement('pre');
  out.className = 'tune-out';
  out.hidden = true;
  drawer.append(head, out, go);

  const inputs = new Map<TuneKey, { input: HTMLInputElement; out: HTMLElement; row: Row }>();
  for (const g of GROUPS) {
    const det = document.createElement('details');
    det.open = g.name === 'Speed' || g.name === 'Turning';
    det.innerHTML = `<summary>${g.name}</summary>`;
    for (const row of g.rows) {
      const label = document.createElement('label');
      label.innerHTML = `<span>${row.label}</span><output></output>`;
      const input = document.createElement('input');
      Object.assign(input, { type: 'range', min: String(row.min), max: String(row.max), step: String(row.step) });
      label.append(input);
      det.append(label);
      const out = label.querySelector('output')!;
      inputs.set(row.key, { input, out, row });
      input.addEventListener('input', () => {
        T[row.key] = Number(input.value);
        out.textContent = T[row.key].toFixed(decimals(row.step));
        out.classList.toggle('changed', T[row.key] !== DEFAULTS[row.key]);
        save();
        on.change?.(row.key);
      });
    }
    drawer.append(det);
  }
  const refresh = () => {
    for (const [k, { input, out, row }] of inputs) {
      input.value = String(T[k]);
      out.textContent = T[k].toFixed(decimals(row.step));
      out.classList.toggle('changed', T[k] !== DEFAULTS[k]);
    }
  };
  refresh();

  const setOpen = (open: boolean) => {
    drawer.hidden = !open;
    toggle.hidden = open;
    on.open(open);
  };
  toggle.addEventListener('click', () => setOpen(true));
  drawer.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.go) {
      on.go(b.dataset.go);
      setOpen(false);
    } else if (b.dataset.act === 'close') setOpen(false);
    else if (b.dataset.act === 'reset') {
      Object.assign(T, DEFAULTS);
      on.reset(); // the lab puts the current bike's own numbers back
      save();
      refresh();
    } else if (b.dataset.act === 'copy') {
      const changed = Object.fromEntries((Object.keys(DEFAULTS) as TuneKey[]).filter((k) => T[k] !== DEFAULTS[k]).map((k) => [k, T[k]]));
      const text = Object.keys(changed).length ? JSON.stringify(changed, null, 1) : 'Nothing changed from the defaults.';
      out.textContent = text;
      out.hidden = false;
      void copyText(text).then((ok) => {
        b.textContent = ok ? 'Copied' : 'See below';
        setTimeout(() => (b.textContent = 'Copy'), 2000);
      });
    }
  });
  return { toggle: () => setOpen(drawer.hidden), refresh };
}
