// The map (home): Colorado's Front Range, full screen, with the places you can go drawn on top as buttons: the Garage
// (Lafayette), the Shop, and each area from AREAS. The picture is background only (public/map/colorado.png when it
// exists, else a drawn stand-in), so a new place never needs new art. Tapping an area opens its sheet: its challenges
// in three groups with stars, what the next star pays, and Go (or what opens it), then that place's "Just ride" warps.
// Every way out is a real page load to the ride's URL (see main.ts).
import './hub.css';
import { esc } from '../esc';
import { AREAS, PLACE_NAMES, areaStars, type AreaDef } from '../areas';
import { CHALLENGES, lockText, type ChallengeDef, type Group } from '../challenges';
import { starMedals, trickChips, COMBO_TIP } from '../targets';
import { signHtml, nameHtml, medalsHtml, starHtml, mergeNames } from '../pieces';
import { loadGame, loadoutOf, starPays, type Profile, type Store } from '../progress';
import type { Loadout } from '../catalog';
import { LAB_BIKES } from '../../lab/bikes';
import { PLACE_STATIONS, type PlaceId } from '../../world/places/data';

// This page with exactly these params (the URL contract lives in main.ts)
export const pageUrl = (q: Record<string, string | number> = {}): string => {
  const s = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
  return location.pathname + (s ? '?' + s : '');
};

// Where the home pins sit, as fractions of the map (like AREAS[].map): Lafayette out on the plains, the Shop below it.
const HOME = { garage: { x: 0.8, y: 0.5 }, shop: { x: 0.88, y: 0.84 } };
export const placeName = (station: string) => PLACE_NAMES[station] ?? station;
const GROUPS: [Group, string][] = [['trail', 'Trail'], ['downhill', 'Downhill'], ['park', 'Park']];
const SYMBOL = { green: '●', blue: '■', black: '◆' } as const;

const pct = (f: number) => `${(f * 100).toFixed(2)}%`;
export { COG } from '../pieces'; // the cog art (garage, shop and the ride import it from here)
import { COG } from '../pieces';
import { bindPresses } from '../../input/press';
export const sym = (a: AreaDef) => `<span class="sym ${a.symbol}">${SYMBOL[a.symbol]}</span>`;

// A slot per star: gold for each one won; stone with its price and the cog under each one still to win (a run that
// wins two pays both); all three won, the replay pay after them
function starSlots(me: Profile, id: string): string {
  const p = starPays(me, id);
  const slots = [0, 1, 2].map((i) => (i < p.have ? `<span class="slot">${starHtml(true)}</span>` : `<span class="slot">${starHtml(false)}<small>${p.left[i - p.have]}${COG}</small></span>`));
  return `${slots.join('')}${p.left.length ? '' : `<span class="pay">replay +${p.repeat} ${COG}</span>`}`;
}

// An open challenge: its name with its hill icon, a slot per star, and Go (the area sheet here and the ride's list)
export function challengeRow(me: Profile, c: ChallengeDef): string {
  return `<div class="row" data-c="${c.id}">
    <div class="what"><b>${nameHtml(c.name)}</b><span class="meta">${starSlots(me, c.id)}</span></div>
    <button class="go">Go</button>
  </div>`;
}
// Locked challenges that share a lock: one quiet dashed row, just the names and what opens them (no stars or prices,
// so the open ones stand out)
function lockedRow(defs: ChallengeDef[], lock: string): string {
  return `<div class="row locked" data-c="${defs[0].id}" data-cs="${defs.map((c) => c.id).join(' ')}">
    <div class="what"><b>${nameHtml(mergeNames(defs.map((c) => c.name)))}</b><span class="lock">🔒 ${nameHtml(lock)}</span></div>
  </div>`;
}
// A group's rows, in order: each open challenge, and each lock once, where its first challenge is
function groupRows(me: Profile, l: Loadout, defs: ChallengeDef[]): string {
  const locks = new Map<string, ChallengeDef[]>();
  for (const c of defs) {
    const lock = lockText(me, c, l);
    if (lock) locks.set(lock, [...(locks.get(lock) ?? []), c]);
  }
  return defs
    .map((c) => {
      const lock = lockText(me, c, l);
      if (!lock) return challengeRow(me, c);
      return locks.get(lock)![0] === c ? lockedRow(locks.get(lock)!, lock) : '';
    })
    .join('');
}
// The head of an area's sheet: the area's name on the trail sign, its stars, and the sheet's own button (the map's ✕,
// the ride's Ride ▶)
export function areaHead(me: Profile, a: AreaDef, button: string): string {
  return `<div class="sheet-head">${signHtml(esc(a.name), sym(a))}<span class="pill area-stars"><span>${starHtml(true)} ${areaStars(me, a)} of ${a.challenges.length * 3}</span></span>${button}</div>`;
}

// A ring's card: the picked open challenge on its sign (tabs when more than one is open), its how-to in big type, the
// three star medals, on point challenges what tricks are worth, and Go; each locked challenge here is one quiet line
// with what opens it. pick: a challenge id (a tab tapped), else the first open one
const symOf = (c: ChallengeDef) => { const a = AREAS.find((x) => x.challenges.includes(c.id)); return a ? sym(a) : ''; };
export function ringCard(me: Profile, l: Loadout, defs: ChallengeDef[], pick?: string): string {
  const open = defs.filter((c) => !lockText(me, c, l)), c = open.find((d) => d.id === pick) ?? open[0];
  const tabs = open.length > 1 ? `<div class="tabs">${open.map((d) => `<button class="tab" data-tab="${d.id}" aria-pressed="${d === c}">${nameHtml(d.name)}</button>`).join('')}</div>` : '';
  const tricks = c && trickChips(c.goal);
  const chips = tricks ? `<div class="chips"><small>${tricks.where}</small>${tricks.chips.map(([n, v]) => `<span class="chip">${esc(n)} <b>${v}</b></span>`).join('')}<p class="tip">${COMBO_TIP}</p></div>` : '';
  // nothing open here yet: the sign still names the ring's challenges, then what opens each
  const head = c ? '' : signHtml(nameHtml(mergeNames(defs.map((d) => d.name))), symOf(defs[0]));
  const ring = c ? `<div class="ring" data-c="${c.id}">${signHtml(nameHtml(c.name), symOf(c))}<p class="tell">${esc(c.tell)}</p>${medalsHtml(starMedals(c.goal, starPays(me, c.id)))}${chips}<button class="go primary">Go</button></div>` : '';
  const locked = defs.filter((d) => !open.includes(d)).map((d) => `<p class="ring-lock" data-c="${d.id}">🔒 ${nameHtml(d.name)} <span>${nameHtml(lockText(me, d, l)!)}</span></p>`).join('');
  return `${tabs}${head}${ring}${locked}<div class="buttons"><button class="close">Not now</button></div>`;
}

// An area's challenges in their groups (the empty ones left out), then the "Just ride" warps (the map's sheet and the ride's list)
export function areaList(me: Profile, l: Loadout, a: AreaDef): string {
  const defs = a.challenges.map((id) => CHALLENGES.find((c) => c.id === id)).filter((c): c is ChallengeDef => !!c);
  return `<div class="groups">${GROUPS.filter(([g]) => defs.some((c) => c.group === g)).map(([g, name]) => `<div class="group"><h3>${name}</h3>${groupRows(me, l, defs.filter((c) => c.group === g))}</div>`).join('')}</div>
    <h3>Just ride</h3>
    <div class="warps">${PLACE_STATIONS[a.id as PlaceId].map((st) => `<button data-at="${st}">${esc(placeName(st))}</button>`).join('')}</div>`;
}

export function showMap(hub: HTMLElement, store: Store, index: number): void {
  let me: Profile, l: Loadout, sheet: HTMLElement, scrim: HTMLElement;
  const $ = <E extends HTMLElement>(sel: string) => hub.querySelector<E>(sel)!;
  // from the save each time: after Back from a ride, cogs and stars may have changed
  function draw(): void {
    me = loadGame(store).riders[index];
    l = loadoutOf(me);
    hub.hidden = false;
    hub.innerHTML = `
      <div class="map">
        ${PLACEHOLDER}
        <img class="art" alt="" hidden>
        <button class="pin home" data-place="garage" style="left:${pct(HOME.garage.x)};top:${pct(HOME.garage.y)}"><span class="b">🏠 Garage<small>Lafayette</small></span></button>
        <button class="pin shop" data-place="shop" style="left:${pct(HOME.shop.x)};top:${pct(HOME.shop.y)}"><span class="b">🛒 Shop</span></button>
        ${AREAS.map((a) => `<button class="pin area" data-place="${a.id}" style="left:${pct(a.map.x)};top:${pct(a.map.y)}"><span class="b">${sym(a)} ${esc(a.name)}<small>★ ${areaStars(me, a)} of ${a.challenges.length * 3}</small></span></button>`).join('')}
      </div>
      <div class="bar">
        <span class="pill who">🧒 ${esc(me.name)} · ${esc(LAB_BIKES[l.bike].name)}</span>
        <span class="pill cogs"><span>${me.cogs} ${COG}</span></span>
        <button class="pill switch">Switch rider</button>
      </div>
      <div class="scrim" hidden></div>
      <div class="sheet" hidden></div>`;
    sheet = $('.sheet');
    scrim = $('.scrim');

    // the real picture only once it has loaded; until then (or without one) the drawn map stays
    const art = $<HTMLImageElement>('.art');
    art.addEventListener('load', () => {
      art.hidden = false;
      $('.map svg').style.display = 'none';
    });
    art.src = 'map/colorado.png';
  }
  draw();

  function openArea(a: AreaDef): void {
    sheet.innerHTML = `
      ${areaHead(me, a, '<button class="close" aria-label="Close">✕</button>')}
      ${areaList(me, l, a)}`;
    sheet.scrollTop = 0;
    sheet.hidden = scrim.hidden = false;
  }
  const close = () => (sheet.hidden = scrim.hidden = true);
  let leaving = false; // a second tap while the next page loads does nothing
  // Back (or a swipe back) can restore this page from the back-forward cache, JS state and all: let taps work again,
  // and redraw from the save
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    draw();
  });
  const leave = (url: string) => {
    if (leaving) return;
    leaving = true;
    location.href = url;
  };
  // a tap on the backdrop is no button: it closes the sheet through click. Every button presses as the finger lifts,
  // even with another finger on the glass (see input/press.ts)
  hub.addEventListener('click', (e) => {
    if (e.target === scrim) close();
  });
  bindPresses(hub, (btn) => {
    const place = btn.dataset.place, area = AREAS.find((a) => a.id === place);
    if (area) openArea(area);
    else if (place === 'garage') leave(pageUrl({ rider: index, view: 'garage' }));
    else if (place === 'shop') leave(pageUrl({ rider: index, view: 'shop' }));
    else if (btn.classList.contains('close')) close();
    else if (btn.classList.contains('switch')) leave(pageUrl());
    else if (btn.classList.contains('go')) leave(pageUrl({ rider: index, go: btn.closest<HTMLElement>('.row')!.dataset.c! }));
    else if (btn.dataset.at) leave(pageUrl({ rider: index, at: btn.dataset.at }));
  });
}

// The stand-in map, until public/map/colorado.png exists: sky, the snowy Divide on the left (west), green foothills
// and red Flatirons in the middle, golden plains with a lake and fields on the right, I-70 winding up into the peaks.
// Colors from the Nano Banana prompt. 4:3, like the picture will be.
const PLACEHOLDER = `<svg viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="m-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb0de"/><stop offset="1" stop-color="#cfe0f0"/></linearGradient>
    <linearGradient id="m-land" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f8a4e"/><stop offset=".38" stop-color="#8fae5a"/><stop offset=".58" stop-color="#b9bf72"/><stop offset="1" stop-color="#ddd1b2"/></linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#m-land)"/>
  <path d="M0 0H400V40C330 34 270 46 200 38S80 30 0 44Z" fill="url(#m-sky)"/>
  <!-- the plains: fields, a lake, cottonwoods -->
  <g opacity=".55"><rect x="262" y="70" width="44" height="26" rx="4" fill="#e6d9a0"/><rect x="312" y="62" width="52" height="30" rx="4" fill="#c9c47a"/><rect x="330" y="190" width="50" height="34" rx="4" fill="#e6d9a0"/><rect x="268" y="218" width="40" height="30" rx="4" fill="#c9c47a"/><rect x="350" y="112" width="40" height="28" rx="4" fill="#e6d9a0"/></g>
  <ellipse cx="300" cy="128" rx="20" ry="10" fill="#6f8fbf"/><ellipse cx="300" cy="126" rx="19" ry="9" fill="#8fb0de"/>
  <g fill="#6b8f4a"><circle cx="276" cy="122" r="5"/><circle cx="284" cy="114" r="4"/><circle cx="326" cy="138" r="5"/><circle cx="252" cy="178" r="4"/><circle cx="380" cy="168" r="5"/><circle cx="292" cy="268" r="5"/></g>
  <!-- mesas between the plains and the foothills -->
  <g fill="#c7b48a"><path d="M214 238h44l8 14h-60z"/><path d="M228 98h30l7 11h-44z"/></g>
  <g fill="#a8956a"><path d="M206 252h60l-3 4h-54z"/><path d="M221 109h44l-3 3h-38z"/></g>
  <!-- foothills, with the red Flatirons -->
  <g fill="#4f7d45"><ellipse cx="170" cy="120" rx="46" ry="26"/><ellipse cx="190" cy="200" rx="50" ry="30"/><ellipse cx="150" cy="262" rx="54" ry="28"/><ellipse cx="200" cy="60" rx="40" ry="20"/></g>
  <g fill="#8fae5a" opacity=".5"><ellipse cx="180" cy="114" rx="30" ry="14"/><ellipse cx="200" cy="192" rx="32" ry="15"/></g>
  <g fill="#8a4f3c"><path d="M196 86l10-26 6 30z"/><path d="M208 92l10-28 6 32z"/><path d="M221 96l8-22 6 26z"/></g>
  <g fill="#b06a50"><path d="M200 86l6-18 2 21z"/><path d="M212 92l6-20 2 23z"/></g>
  <!-- the mountains in the west, snow on the peaks -->
  <g fill="#7f8f86"><path d="M-10 160L28 66 66 160z"/><path d="M40 176L86 56 132 176z"/><path d="M98 166L132 92 166 166z"/><path d="M-10 250L30 170 70 250z"/><path d="M50 260L96 172 142 260z"/></g>
  <g fill="#65746c"><path d="M28 66L66 160H44z"/><path d="M86 56L132 176H106z"/><path d="M132 92L166 166H146z"/><path d="M30 170L70 250H52z"/><path d="M96 172L142 260H120z"/></g>
  <g fill="#f2f0eb"><path d="M28 66l-11 27 7-4 5 5 6-6 5 3z"/><path d="M86 56l-14 36 8-5 6 6 7-7 7 4z"/><path d="M132 92l-9 20 6-3 4 4 5-5 4 2z"/><path d="M30 170l-9 18 6-3 4 4 4-4 4 2z"/><path d="M96 172l-10 20 6-3 5 4 5-4 4 2z"/></g>
  <g fill="#3f6b3a"><path d="M18 196l5-12 5 12z"/><path d="M26 204l5-12 5 12z"/><path d="M150 150l5-12 5 12z"/><path d="M158 158l5-12 5 12z"/><path d="M80 282l5-12 5 12z"/><path d="M88 288l5-12 5 12z"/><path d="M168 236l5-12 5 12z"/><path d="M136 196l5-12 5 12z"/></g>
  <!-- I-70, winding west into the peaks -->
  <path d="M0 214C40 206 60 222 96 206S150 200 186 214 250 196 300 180 370 170 400 172" stroke="#f2f0eb" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M0 214C40 206 60 222 96 206S150 200 186 214 250 196 300 180 370 170 400 172" stroke="#ddd1b2" stroke-width="1.2" stroke-dasharray="4 5" fill="none"/>
</svg>`;
