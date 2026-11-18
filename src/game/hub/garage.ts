// The Garage (?rider=i&view=garage): the bike you're looking at on its stand, rider and all, with a glowing dot on
// each slot. Tap a dot for that slot's card: the part on now, the ones on your wall, and the shop's next one, each with
// only the stats it moves. Tabs: Parts, Paint (free colors), Specs (the full sheet and the eight bars). A strip of your
// bikes switches the stand; "Ride this one" picks the bike you ride. Every change re-reads the save, changes only this
// rider, and saves (another page may have written since this one loaded).
import './hub.css';
import { loadout, partsFor, SHEETS, SLOTS, type Loadout, type PartDef, type Slot } from '../catalog';
import { statsFor, STAT_GROUPS, type Stat } from '../stats';
import { buyPart, fitPart, loadGame, loadoutOf, paint, PAINTS, rideBike, type Profile, type Store } from '../progress';
import { LAB_BIKES, type LabBikeId } from '../../lab/bikes';
import { COG, pageUrl } from './map';
import { createStand, type Stand } from './stand';
import { bar, esc, hex, num, SLOT_NAMES, STATS, writeRider } from './ui';

const PAINT_NAMES: Record<number, string> = { 0xe63946: 'Red', 0xf26b1d: 'Orange', 0xffd84a: 'Yellow', 0x4cc35a: 'Green', 0x1fb5c8: 'Sky', 0x3a7bd5: 'Blue', 0x8e5bd9: 'Purple', 0xff7eb6: 'Pink' };
type Tab = 'parts' | 'paint' | 'specs';

export function showGarage(hub: HTMLElement, store: Store, index: number): void {
  let me: Profile, bike: LabBikeId, l: Loadout, stand: Stand | null = null;
  let tab: Tab = 'parts', slot: Slot | null = null, pick: string | null = null, riderOn = true;
  const $ = <E extends HTMLElement>(sel: string) => hub.querySelector<E>(sel)!;

  const read = () => {
    me = loadGame(store).riders[index];
    if (!me.bikes[bike]) bike = me.riding;
    l = loadoutOf(me, bike);
  };
  // re-read the store, change only this rider, save; false when the move isn't allowed (a second tap on Buy)
  function write(fn: (p: Profile) => Profile | null): boolean {
    if (!writeRider(store, index, fn)) return false;
    read();
    stand?.show(l);
    return true;
  }

  function mount(): void {
    bike = loadGame(store).riders[index].riding;
    read();
    hub.hidden = false;
    hub.innerHTML = `
      <div class="garage">
        <div class="stage">
          <canvas></canvas>
          <div class="dots">${SLOTS.map((s) => `<button class="dot" data-slot="${s}" aria-label="${SLOT_NAMES[s]}"><i></i><span>${SLOT_NAMES[s]}</span></button>`).join('')}</div>
          <div class="hint">⟲ Drag to spin</div>
          <button class="rider-toggle" aria-pressed="true" aria-label="Show or hide the rider">👤</button>
          <div class="bikes"></div>
        </div>
        <div class="bar">
          <button class="pill back">← Map</button>
          <span class="pill title">🏠 ${esc(me.name)}'s garage</span>
          <span class="pill cogs"></span>
        </div>
        <div class="side">
          <div class="tabs">${(['parts', 'paint', 'specs'] as Tab[]).map((t) => `<button class="tab" data-tab="${t}">${{ parts: '🔧 Parts', paint: '🎨 Paint', specs: '📋 Specs' }[t]}</button>`).join('')}</div>
          <div class="panel"></div>
        </div>
        <div class="note" hidden></div>
      </div>`;
    stand = createStand($<HTMLCanvasElement>('.garage canvas'), { onFrame: placeDots });
    stand.setRider(riderOn);
    stand.show(l);
    const s = stand;
    (window as unknown as { __stand: unknown }).__stand = { frameColor: () => s.frameColor(), riderVisible: () => s.riderVisible(), bike: () => s.bike() };
    draw();
  }
  function unmount(): void {
    stand?.dispose();
    stand = null;
  }

  // the dots follow their parts every frame; a part round the far side of the bike fades but stays tappable
  function placeDots(): void {
    if (!stand) return;
    for (const d of hub.querySelectorAll<HTMLElement>('.garage .dot')) {
      const a = stand.anchor(d.dataset.slot as Slot);
      d.hidden = !a;
      if (!a) continue;
      d.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
      d.classList.toggle('behind', a.behind);
    }
  }

  function draw(): void {
    $('.garage .cogs').innerHTML = `<span>${me.cogs} ${COG}</span>`;
    for (const t of hub.querySelectorAll<HTMLElement>('.garage .tab')) t.classList.toggle('on', t.dataset.tab === tab);
    for (const d of hub.querySelectorAll<HTMLElement>('.garage .dot')) d.classList.toggle('sel', tab === 'parts' && d.dataset.slot === slot);
    const toggle = $('.garage .rider-toggle');
    toggle.classList.toggle('off', !riderOn);
    toggle.setAttribute('aria-pressed', String(riderOn));
    const owned = (Object.keys(LAB_BIKES) as LabBikeId[]).filter((b) => me.bikes[b]);
    $('.garage .bikes').innerHTML = `${owned.map((b) => `<button class="bike${b === bike ? ' on' : ''}" data-bike="${b}"><i style="background:${hex(me.bikes[b]!.color)}"></i>${esc(LAB_BIKES[b].name)}</button>`).join('')}
      ${bike === me.riding ? '<span class="riding">✓ You ride this one</span>' : '<button class="ride-this">Ride this one</button>'}`;
    const panel = $('.garage .panel');
    panel.innerHTML = tab === 'parts' ? (slot ? card(slot) : slotList()) : tab === 'paint' ? paintTab() : specsTab();
    panel.scrollTop = 0;
  }

  const partOf = (id: string) => partsFor(bike, slot ?? undefined).find((p) => p.id === id)!;
  const owns = (p: PartDef) => !!p.stock || !!me.bikes[bike]?.parts.includes(p.id);

  function slotList(): string {
    return `<h2>${esc(LAB_BIKES[bike].name)}</h2>
      <p class="lead">Tap a glowing dot on the bike, or a part here.</p>
      <div class="slots">${SLOTS.map((s) => {
        const p = partsFor(bike, s).find((x) => x.id === l.fitted[s])!;
        return `<button class="slotrow" data-slot="${s}"><span class="sl">${SLOT_NAMES[s]}</span><b>${esc(p.name)}</b></button>`;
      }).join('')}</div>`;
  }

  // a slot's card: the part on now, the ones on the wall, the ones in the shop; then the picked one's details
  function card(s: Slot): string {
    const all = partsFor(bike, s), on = all.find((p) => p.id === l.fitted[s])!;
    const wall = all.filter((p) => p !== on && owns(p));
    const shop = all.filter((p) => !owns(p)); // every part still in the shop, so a lock hint can name any of them
    const opts = [on, ...wall, ...shop];
    if (!pick || !opts.some((p) => p.id === pick)) pick = (wall[0] ?? shop[0] ?? on).id;
    const sel = partOf(pick);
    const tag = (p: PartDef) => (p === on ? 'On now' : owns(p) ? 'On the wall' : `In the shop · ${p.price} ${COG}`);
    // the stats this part moves, against what's on now; for the part on now, the ones this slot's parts move
    const now = statsFor(l), stock = all.find((p) => p.stock)!;
    const withPart = (p: PartDef) => statsFor(loadout(bike, { ...l.fitted, [s]: p.id }, me.bikes[bike]!.color));
    const moved = (a: Record<Stat, number>, b: Record<Stat, number>) => STATS.filter((k) => Math.abs(a[k] - b[k]) >= 0.05);
    let rows: string;
    if (sel !== on) {
      const next = withPart(sel);
      rows = moved(now, next).map((k) => bar(k, now[k], next[k])).join('');
    } else {
      const ks = sel === stock ? [...new Set(all.flatMap((p) => moved(now, withPart(p))))] : moved(now, withPart(stock));
      rows = STATS.filter((k) => ks.includes(k)).map((k) => bar(k, now[k], now[k], 'held')).join('');
    }
    const short = sel.price - me.cogs;
    const action = sel === on ? '<div class="onnow">✓ On your bike</div>'
      : owns(sel) ? '<button class="fit">Put it on</button>'
      : short > 0 ? `<button class="buy" disabled>Need ${short} more ${COG}</button>`
      : `<button class="buy">Buy · ${sel.price} ${COG}</button>`;
    return `<div class="card">
      <div class="card-head"><button class="to-slots" aria-label="All parts">‹</button><h2>${SLOT_NAMES[s]}</h2></div>
      <div class="opts">${opts.map((p) => `<button class="opt${p === sel ? ' sel' : ''}${owns(p) ? '' : ' shop'}" data-part="${p.id}"><b>${esc(p.name)}</b><small>${tag(p)}</small></button>`).join('')}</div>
      <div class="detail">
        <h3>${esc(sel.name)}</h3>
        <p class="spec">${esc(sel.spec)}</p>
        <p class="does">${esc(sel.does)}</p>
        <div class="stats">${rows || '<p class="lead">Changes nothing you can see on the bars.</p>'}</div>
        ${action}
      </div>
    </div>`;
  }

  function paintTab(): string {
    const own = LAB_BIKES[bike].frameColor, cur = me.bikes[bike]!.color;
    const colors = [own, ...PAINTS.filter((c) => c !== own)];
    return `<h2>Paint</h2>
      <p class="lead">Free! Tap a color.</p>
      <div class="swatches">${colors.map((c) => `<button class="swatch${c === cur ? ' on' : ''}" data-color="${c}" aria-label="${c === own ? 'Its own color' : PAINT_NAMES[c] ?? 'Paint'}"><i style="background:${hex(c)}"></i><small>${c === own ? 'Its own' : PAINT_NAMES[c] ?? ''}</small></button>`).join('')}</div>`;
  }

  // the spec sheet: a real bike-shop sheet, with what the parts change marked
  function specsTab(): string {
    const base = SHEETS[bike], sh = l.sheet, st = statsFor(l);
    const row = (k: string, v: string, was?: string) => `<tr${was ? ' class="changed"' : ''}><th>${k}</th><td>${v}${was ? `<small>was ${was}</small>` : ''}</td></tr>`;
    return `<div class="specs">
      <h2>${esc(LAB_BIKES[bike].name)}</h2>
      <p class="lead">${esc(sh.type)}</p>
      <table class="spec-sheet">
        ${row('Wheels', esc(sh.wheels))}
        ${row('Head angle', `${num(sh.headAngle)}°`, sh.headAngle !== base.headAngle ? `${num(base.headAngle)}°` : undefined)}
        ${row('Wheelbase', `${sh.wheelbase} mm`)}
        ${row('Reach', `${sh.reach} mm`)}
        ${row('Weight', `${num(sh.weight)} kg`, Math.abs(sh.weight - base.weight) > 0.01 ? `${num(base.weight)} kg` : undefined)}
      </table>
      <table class="spec-sheet parts">${SLOTS.map((s) => {
        const p = partsFor(bike, s).find((x) => x.id === l.fitted[s])!;
        return `<tr${p.stock ? '' : ' class="changed"'}><th>${SLOT_NAMES[s]}</th><td><b>${esc(p.name)}</b><small>${esc(p.spec)}</small></td></tr>`;
      }).join('')}</table>
      <div class="statgroups">${STAT_GROUPS.map((g) => `<div class="statgroup"><h3>${g.name}</h3>${g.stats.map((k) => bar(k, st[k])).join('')}</div>`).join('')}</div>
    </div>`;
  }

  let noteTimer = 0;
  function say(t: string): void {
    const note = $('.garage .note');
    note.innerHTML = t;
    note.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => (note.hidden = true), 1800);
  }

  let leaving = false; // a second tap while the map loads does nothing
  const leave = (url: string) => {
    if (leaving) return;
    leaving = true;
    location.href = url;
  };
  // the renderer goes when the page does; Back (or a swipe back) from the cache builds it again from the save
  window.addEventListener('pagehide', unmount);
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    unmount();
    mount();
  });

  hub.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.garage button');
    if (!btn || btn.disabled) return;
    const c = btn.classList;
    if (c.contains('back')) return leave(pageUrl({ rider: index }));
    if (c.contains('tab')) tab = btn.dataset.tab as Tab;
    else if (c.contains('dot') || c.contains('slotrow')) {
      tab = 'parts';
      slot = btn.dataset.slot as Slot;
      pick = null;
    } else if (c.contains('to-slots')) slot = null;
    else if (c.contains('opt')) pick = btn.dataset.part!;
    else if (c.contains('buy') && pick) {
      const p = partOf(pick);
      if (write((r) => buyPart(r, p.id))) say(`${esc(p.name)} ${p.name.endsWith('s') ? 'are' : 'is'} on your wall`);
    } else if (c.contains('fit') && pick) {
      const p = partOf(pick);
      if (write((r) => fitPart(r, p.id))) say(`${esc(p.name)} on!`);
    } else if (c.contains('swatch')) write((r) => paint(r, bike, Number(btn.dataset.color)));
    else if (c.contains('rider-toggle')) stand?.setRider((riderOn = !riderOn));
    else if (c.contains('bike') && btn.dataset.bike) {
      bike = btn.dataset.bike as LabBikeId;
      slot = pick = null;
      read();
      stand?.show(l);
    } else if (c.contains('ride-this')) {
      if (write((r) => rideBike(r, bike))) say(`You ride the ${esc(LAB_BIKES[bike].name)} now`);
    } else return;
    draw();
  });

  mount();
}
