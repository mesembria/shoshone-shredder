// A rider's progress: cogs, the bikes they own with the parts bought and fitted, paint, and stars per challenge. Two
// riders share the iPad; the save lives in localStorage. Every change is a pure function: a new Profile, or null when
// the move isn't allowed (so a double tap on Buy can never charge twice).
import { LAB_BIKES, type LabBikeId } from '../lab/bikes';
import { loadout, PARTS, SHEETS, SLOTS, stockFitted, type Fitted, type Loadout } from './catalog';

export interface OwnedBike { parts: string[]; fitted: Fitted; color: number }
export interface Profile { name: string; cogs: number; riding: LabBikeId; bikes: Partial<Record<LabBikeId, OwnedBike>>; stars: Record<string, number>; paid: Record<string, number> }
export interface SaveGame { version: 2; riders: Profile[] }

export const SAVE_KEY = 'shredder-save';
export const PAY = { tiers: [20, 45, 110], repeatShare: 0.2 }; // first guesses; Task 12 retunes
// Eight bright toy colors, free for any bike (a bike's own color is always allowed too).
export const PAINTS: number[] = [0xe63946, 0xf26b1d, 0xffd84a, 0x4cc35a, 0x1fb5c8, 0x3a7bd5, 0x8e5bd9, 0xff7eb6];

export type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };

const isBikeId = (id: unknown): id is LabBikeId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(LAB_BIKES, id);

export function freshBike(bike: LabBikeId): OwnedBike {
  return { parts: [], fitted: stockFitted(bike), color: LAB_BIKES[bike].frameColor };
}

export function newProfile(name: string): Profile {
  return { name, cogs: 0, riding: 'hardtail', bikes: { hardtail: freshBike('hardtail') }, stars: {}, paid: {} };
}

export function totalStars(p: Profile): number {
  return Object.values(p.stars).reduce((a, b) => a + b, 0);
}

// What the rider rides: `bike` (default the one they're riding), or the hardtail if they don't own it. Fitted ids they
// don't own, or that don't exist, fit as stock (catalog.loadout also drops other bikes' parts).
export function loadoutOf(p: Profile, bike: LabBikeId = p.riding): Loadout {
  const id = p.bikes[bike] ? bike : 'hardtail';
  const own = p.bikes[id] ?? freshBike(id);
  const stock = stockFitted(id);
  const fitted = { ...stock };
  for (const s of SLOTS) {
    const f = own.fitted[s];
    if (f !== stock[s] && own.parts.includes(f)) fitted[s] = f;
  }
  return loadout(id, fitted, own.color);
}

const repeatPay = () => Math.round(PAY.tiers[0] * PAY.repeatShare);
// What each star still to win pays (in order), and the replay pay once all three are won (0 until then). The trail list
// shows a price on each empty star, and payFor pays the sum of the ones a run wins, so they can't disagree.
export function starPays(p: Profile, challengeId: string): { have: number; left: number[]; repeat: number } {
  const have = Math.min(3, p.stars[challengeId] ?? 0);
  return { have, left: PAY.tiers.slice(have), repeat: have >= 3 ? repeatPay() : 0 };
}

// Each new star tier pays once; a clear with no new star pays a small share; 0 stars is a fail and pays nothing.
export function payFor(p: Profile, challengeId: string, stars: number): { profile: Profile; cogs: number; newStars: number } {
  if (stars <= 0) return { profile: p, cogs: 0, newStars: 0 };
  const had = p.stars[challengeId] ?? 0;
  const best = Math.min(3, Math.max(had, stars));
  const newStars = best - had;
  const cogs = newStars > 0 ? PAY.tiers.slice(had, best).reduce((a, b) => a + b, 0) : repeatPay();
  const profile: Profile = {
    ...p,
    cogs: p.cogs + cogs,
    stars: { ...p.stars, [challengeId]: best },
    paid: { ...p.paid, [challengeId]: (p.paid[challengeId] ?? 0) + 1 },
  };
  return { profile, cogs, newStars };
}

export function buyBike(p: Profile, bike: LabBikeId): Profile | null {
  const price = isBikeId(bike) ? SHEETS[bike].price : NaN;
  if (!(price >= 0) || p.bikes[bike] || p.cogs < price) return null;
  return { ...p, cogs: p.cogs - price, bikes: { ...p.bikes, [bike]: freshBike(bike) } };
}

export function buyPart(p: Profile, partId: string): Profile | null {
  const part = PARTS.find((x) => x.id === partId);
  const own = part && p.bikes[part.bike];
  if (!part || !own || part.stock || own.parts.includes(partId) || p.cogs < part.price) return null;
  return { ...p, cogs: p.cogs - part.price, bikes: { ...p.bikes, [part.bike]: { ...own, parts: [...own.parts, partId] } } };
}

// Fits a part the rider owns (a bought one, or the bike's stock part) into its slot.
export function fitPart(p: Profile, partId: string): Profile | null {
  const part = PARTS.find((x) => x.id === partId);
  const own = part && p.bikes[part.bike];
  if (!part || !own || !(part.stock || own.parts.includes(partId))) return null;
  return { ...p, bikes: { ...p.bikes, [part.bike]: { ...own, fitted: { ...own.fitted, [part.slot]: partId } } } };
}

export function paint(p: Profile, bike: LabBikeId, color: number): Profile | null {
  const own = p.bikes[bike];
  if (!own || !isBikeId(bike) || !(PAINTS.includes(color) || color === LAB_BIKES[bike].frameColor)) return null;
  return { ...p, bikes: { ...p.bikes, [bike]: { ...own, color } } };
}

export function rideBike(p: Profile, bike: LabBikeId): Profile | null {
  return p.bikes[bike] ? { ...p, riding: bike } : null;
}

// The Shop's buy: the new bike is the one you ride. Null when the buy is refused, so a double tap can't charge twice.
export function buyAndRideBike(p: Profile, bike: LabBikeId): Profile | null {
  const bought = buyBike(p, bike);
  return bought && rideBike(bought, bike);
}

// ---- saving

const isObj = (r: unknown): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r);

// A table of counts (stars 0-3, times paid): each entry that is a whole, sensible number is kept, any other is dropped, so
// one hand-edited value can't cost the rider the rest of their save (or show as "undefined" or NaN). Null if not a table.
function cleanCounts(r: unknown, max: number): Record<string, number> | null {
  if (!isObj(r)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(max, Math.max(0, Math.floor(v)));
  return out;
}

// A v2 rider that passes the shape checks, or null (the caller then starts that rider fresh).
function checkRider(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bikesRaw = r.bikes;
  if (typeof r.name !== 'string' || typeof r.cogs !== 'number' || !Number.isFinite(r.cogs) || r.cogs < 0) return null;
  const stars = cleanCounts(r.stars, 3), paid = cleanCounts(r.paid, 1e6);
  if (!isBikeId(r.riding) || !bikesRaw || typeof bikesRaw !== 'object' || !stars || !paid) return null;
  const bikes: Profile['bikes'] = {};
  for (const [id, b] of Object.entries(bikesRaw)) {
    const o = b as Partial<OwnedBike> | null;
    if (!isBikeId(id) || !o || typeof o !== 'object' || !Array.isArray(o.parts) || !o.parts.every((x) => typeof x === 'string')) return null;
    if (typeof o.color !== 'number' || !Number.isFinite(o.color) || !o.fitted || typeof o.fitted !== 'object') return null;
    const fitted = { ...stockFitted(id) };
    for (const s of SLOTS) if (typeof o.fitted[s] === 'string') fitted[s] = o.fitted[s];
    bikes[id] = { parts: [...o.parts], fitted, color: o.color };
  }
  if (!bikes.hardtail) bikes.hardtail = freshBike('hardtail');
  return { name: r.name, cogs: Math.floor(r.cogs), riding: bikes[r.riding] ? r.riding : 'hardtail', bikes, stars, paid };
}

// v1 saves, corrupt saves and broken riders all start fresh; a name survives whenever there is one.
export function loadGame(store: Store): SaveGame {
  let raw: { version?: unknown; riders?: unknown } = {};
  try {
    const parsed = JSON.parse(store.getItem(SAVE_KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') raw = parsed;
  } catch {
    raw = {};
  }
  const riders = Array.isArray(raw.riders) ? raw.riders : [];
  return {
    version: 2,
    riders: [0, 1].map((i) => {
      const r = riders[i] as { name?: unknown } | null | undefined;
      const name = r && typeof r.name === 'string' && r.name ? r.name : `Rider ${i + 1}`;
      return (raw.version === 2 && checkRider(riders[i])) || newProfile(name);
    }),
  };
}

export function saveGame(store: Store, g: SaveGame): void {
  store.setItem(SAVE_KEY, JSON.stringify(g));
}

// ---- backup: the whole save as text, so it can be copied off one browser address and pasted into another

export function exportSave(store: Store): string {
  return JSON.stringify(loadGame(store));
}

// A save from exportSave (or the SAVE_KEY value), or null when the text isn't a whole, valid v2 save. Stricter than
// loadGame, which quietly resets a bad rider: restoring a backup must never turn a rider into a fresh one.
export function parseSave(text: string): SaveGame | null {
  let raw: { version?: unknown; riders?: unknown };
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || raw.version !== 2 || !Array.isArray(raw.riders) || raw.riders.length !== 2) return null;
  const riders = raw.riders.map(checkRider);
  return riders[0] && riders[1] ? { version: 2, riders: [riders[0], riders[1]] } : null;
}
