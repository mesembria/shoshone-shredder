// The Shop (?rider=i&view=shop): the Garage's stand and look, for things you don't own. Bikes: each bike you don't own
// on the stand with the rider, its sheet, the eight bars, the price and Buy. Parts: every non-stock part for each bike
// you own, by bike then slot, each with only the stats it moves against what's fitted. Whatever you own reads "In your
// garage" in place of Buy, so a double tap can't do a second thing. Every buy re-reads the save (see ui.ts writeRider).
import './hub.css';
import { loadout, partsFor, SHEETS, SLOTS, type Loadout, type PartDef } from '../catalog';
import { statsFor, STAT_GROUPS, type Stat } from '../stats';
import { buyAndRideBike, buyPart, loadGame, loadoutOf, type Profile, type Store } from '../progress';
import { LAB_BIKES, type LabBikeId } from '../../lab/bikes';
import { COG, pageUrl } from './map';
import { createStand, type Stand } from './stand';
import { bar, esc, hex, num, SLOT_NAMES, specOf, STATS, writeRider } from './ui';
import { bindPresses } from '../../input/press';

type Tab = 'bikes' | 'parts';
const BIKE_IDS = Object.keys(LAB_BIKES) as LabBikeId[];

export function showShop(hub: HTMLElement, store: Store, index: number): void {
  let me: Profile, stand: Stand | null = null;
  let tab: Tab = 'bikes', riderOn = true;
  let offered: LabBikeId[] = [], sel: LabBikeId | null = null; // Bikes: those you didn't own on arrival, and the one on show
  let shownTab: Tab | null = null;
  let partsBike: LabBikeId = 'hardtail'; // Parts: the bike on the stand
  const $ = <E extends HTMLElement>(sel: string) => hub.querySelector<E>(sel)!;
  const read = () => (me = loadGame(store).riders[index]);
  const owned = () => BIKE_IDS.filter((b) => me.bikes[b]);
  // an owned bike as you have it; a shop bike with its stock parts
  const looks = (b: LabBikeId): Loadout => (me.bikes[b] ? loadoutOf(me, b) : loadout(b, {}));
  const onStand = () => (tab === 'bikes' ? sel : partsBike);
  const showOnStand = () => {
    const b = onStand();
    if (b) stand?.show(looks(b));
  };

  function mount(): void {
    read();
    // a bike you buy here stays in the list (as "In your garage") until you leave, so the spot under your thumb holds still
    offered = BIKE_IDS.filter((b) => !me.bikes[b]);
    sel = offered[0] ?? null;
    partsBike = me.bikes[me.riding] ? me.riding : 'hardtail';
    hub.hidden = false;
    hub.innerHTML = `
      <div class="garage shop">
        <div class="stage">
          <canvas></canvas>
          <div class="hint">⟲ Drag to spin</div>
          <button class="rider-toggle" aria-pressed="true" aria-label="Show or hide the rider">👤</button>
          <div class="bikes"></div>
        </div>
        <div class="bar">
          <button class="pill back">← Map</button>
          <span class="pill title">🛒 The Shop</span>
          <span class="pill cogs"></span>
        </div>
        <div class="side">
          <div class="tabs">${(['bikes', 'parts'] as Tab[]).map((t) => `<button class="tab" data-tab="${t}">${{ bikes: '🚲 Bikes', parts: '🔧 Parts' }[t]}</button>`).join('')}</div>
          <div class="panel"></div>
        </div>
        <div class="note" hidden></div>
      </div>`;
    shownTab = null;
    stand = createStand($<HTMLCanvasElement>('.shop canvas'));
    stand.setRider(riderOn);
    const s = stand;
    (window as unknown as { __stand: unknown }).__stand = { frameColor: () => s.frameColor(), riderVisible: () => s.riderVisible(), bike: () => s.bike() };
    showOnStand();
    draw();
  }
  function unmount(): void {
    stand?.dispose();
    stand = null;
  }

  function draw(): void {
    $('.shop .cogs').innerHTML = `<span>${me.cogs} ${COG}</span>`;
    for (const t of hub.querySelectorAll<HTMLElement>('.shop .tab')) t.classList.toggle('on', t.dataset.tab === tab);
    const toggle = $('.shop .rider-toggle');
    toggle.classList.toggle('off', !riderOn);
    toggle.setAttribute('aria-pressed', String(riderOn));
    // the strip: Bikes steps through the bikes on offer; Parts through the bikes you own
    const strip = tab === 'bikes' ? offered : owned();
    $('.shop .bikes').innerHTML = strip.map((b) => `<button class="bike${b === onStand() ? ' on' : ''}" data-bike="${b}"><i style="background:${hex(me.bikes[b]?.color ?? LAB_BIKES[b].frameColor)}"></i>${esc(LAB_BIKES[b].name)}${tab === 'bikes' && me.bikes[b] ? ' ✓' : ''}</button>`).join('');
    const panel = $('.shop .panel'), keep = panel.scrollTop;
    panel.innerHTML = tab === 'bikes' ? bikesTab() : partsTab();
    panel.scrollTop = tab === shownTab ? keep : 0; // a tap or a buy leaves the list where it was
    shownTab = tab;
  }

  // the price line / button: In your garage, Need N more, or Buy
  function action(owns: boolean, price: number): string {
    const short = price - me.cogs;
    return owns ? `<div class="onnow">✓ In your garage</div>`
      : short > 0 ? `<button class="buy" disabled>Need ${short} more ${COG}</button>`
      : `<button class="buy">Buy · ${price} ${COG}</button>`;
  }

  function bikesTab(): string {
    if (!sel) return `<h2>The Shop</h2><p class="lead">You have every bike. Nice garage!</p>`;
    const sh = SHEETS[sel], st = statsFor(looks(sel));
    const row = (k: string, v: string) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    return `<div class="specs" data-bike="${sel}">
      <h2>${esc(LAB_BIKES[sel].name)}</h2>
      <p class="lead">${esc(sh.type)} · ${sh.price} ${COG}</p>
      ${action(!!me.bikes[sel], sh.price)}
      <table class="spec-sheet">
        ${row('Wheels', esc(sh.wheels))}${row('Head angle', `${num(sh.headAngle)}°`)}${row('Wheelbase', `${sh.wheelbase} mm`)}${row('Reach', `${sh.reach} mm`)}${row('Weight', `${num(sh.weight)} kg`)}
      </table>
      <div class="statgroups">${STAT_GROUPS.map((g) => `<div class="statgroup"><h3>${g.name}</h3>${g.stats.map((k) => bar(k, st[k])).join('')}</div>`).join('')}</div>
    </div>`;
  }

  // every non-stock part for each bike you own, by bike then slot; a card shows only what it moves against what's fitted
  function partCard(b: LabBikeId, p: PartDef): string {
    const own = me.bikes[b]!, l = loadoutOf(me, b);
    const now = statsFor(l), next = statsFor(loadout(b, { ...l.fitted, [p.slot]: p.id }, own.color));
    const rows = STATS.filter((k: Stat) => Math.abs(now[k] - next[k]) >= 0.05).map((k) => bar(k, now[k], next[k])).join('');
    return `<div class="part${b === partsBike ? ' on' : ''}" data-part="${p.id}" data-bike="${b}">
      <div class="ph"><b>${esc(p.name)}</b><small>${esc(specOf(p.name, p.spec))}</small></div>
      <p class="does">${esc(p.does)}</p>
      ${rows ? `<div class="stats">${rows}</div>` : ''}
      ${action(own.parts.includes(p.id), p.price)}
    </div>`;
  }
  function partsTab(): string {
    return owned().map((b) => `<section class="bikegroup">
      <button class="bikehead${b === partsBike ? ' on' : ''}" data-bike="${b}"><i style="background:${hex(me.bikes[b]!.color)}"></i>${esc(LAB_BIKES[b].name)}</button>
      ${SLOTS.map((s) => {
        const ps = partsFor(b, s).filter((p) => !p.stock);
        return ps.length ? `<h3>${SLOT_NAMES[s]}</h3>${ps.map((p) => partCard(b, p)).join('')}` : '';
      }).join('')}
    </section>`).join('');
  }

  let noteTimer = 0;
  function say(t: string): void {
    const note = $('.shop .note');
    note.textContent = t;
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

  // tapping anywhere on a part's card (not on a button) shows its bike on the stand; buttons press as the finger lifts,
  // even with another finger on the glass (see input/press.ts)
  hub.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('button')) return;
    const card = el.closest<HTMLElement>('.shop .part');
    if (!card) return;
    partsBike = card.dataset.bike as LabBikeId;
    showOnStand();
    draw();
  });
  bindPresses(hub, (btn) => {
    if (!btn.closest('.shop')) return;
    const c = btn.classList, card = btn.closest<HTMLElement>('.part');
    if (c.contains('back')) return leave(pageUrl({ rider: index }));
    if (c.contains('tab')) tab = btn.dataset.tab as Tab;
    else if (c.contains('bike') || c.contains('bikehead')) {
      if (tab === 'bikes') sel = btn.dataset.bike as LabBikeId;
      else partsBike = btn.dataset.bike as LabBikeId;
    } else if (c.contains('rider-toggle')) stand?.setRider((riderOn = !riderOn));
    else if (c.contains('buy')) {
      if (card) {
        const p = partsFor(card.dataset.bike as LabBikeId).find((x) => x.id === card.dataset.part)!;
        partsBike = p.bike;
        if (writeRider(store, index, (r) => buyPart(r, p.id))) say('Bought! It\'s in your garage');
        else say('Can\'t buy that right now');
      } else if (sel) {
        const b = sel;
        if (writeRider(store, index, (r) => buyAndRideBike(r, b))) say('Bought! You\'re riding it now');
        else say('Can\'t buy that right now');
      }
      read();
    } else return;
    showOnStand();
    draw();
  });

  mount();
}
