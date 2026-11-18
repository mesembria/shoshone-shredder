// Bake the mountain backdrop (look test). Reads public/backdrop/{south,west,north}.{jpg,png}, lines the side pictures
// up against west where they repeat its end strip, blends across the overlap, cuts out the magenta sky, adds a little
// distance haze, sinks the far ends below the horizon, crops the empty top and the pictures' own near meadow, and writes pieces at most
// 4096 px wide to public/backdrop/baked/ with an info.json the game reads. Run after changing any of the pictures:
//   npx vite-node scripts/bake-backdrop.ts
// Needs ImageMagick (`magick`). Doing this once on the Mac keeps the iPad from holding three 4K pictures in memory
// (Safari also refuses canvases over about 16.7 million pixels).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const DIR = 'public/backdrop', OUT = `${DIR}/baked`;
const HEIGHT = 1344; // pictures are scaled to this height first: about 40 px per degree, sharp at the iPad's 1.5x
const STARTER_STRIP = 0.3; // how much of west's end the starter images in make/ carry
const TRIM_BOTTOM = 0.1; // the pictures' own near meadow: cut, the game's ground is nearer
const HAZE = [0xee, 0xe2, 0xcf], HAZE_SHARE = 0.16;
const MAX_TEX = 4096;

interface Img { w: number; h: number; p: Uint8ClampedArray } // RGBA

const find = (name: string) => ['jpg', 'jpeg', 'png', 'webp'].map((e) => `${DIR}/${name}.${e}`).find((f) => existsSync(f)) ?? null;
function load(file: string): Img {
  const [w0, h0] = execFileSync('magick', ['identify', '-format', '%w %h', file]).toString().split(' ').map(Number);
  const w = Math.round((w0 * HEIGHT) / h0), h = HEIGHT;
  const buf = execFileSync('magick', [file, '-resize', `${w}x${h}!`, '-depth', '8', 'rgba:-'], { maxBuffer: w * h * 4 + 1024 });
  return { w, h, p: new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length) };
}
function save(img: Img, x0: number, w: number, file: string): void {
  const part = new Uint8ClampedArray(w * img.h * 4);
  for (let y = 0; y < img.h; y++) part.set(img.p.subarray((y * img.w + x0) * 4, (y * img.w + x0 + w) * 4), y * w * 4);
  execFileSync('magick', ['-size', `${w}x${img.h}`, '-depth', '8', 'rgba:-', '-define', 'png:compression-level=9', file], { input: Buffer.from(part.buffer) });
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function gray(img: Img, f: number): { d: Float32Array; w: number; h: number } {
  const w = Math.floor(img.w / f), h = Math.floor(img.h / f), d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const k = ((y * f + j) * img.w + x * f + i) * 4;
      s += img.p[k] * 0.3 + img.p[k + 1] * 0.59 + img.p[k + 2] * 0.11;
    }
    d[y * w + x] = s / (f * f);
  }
  return { d, w, h };
}

// Where ext sits against west: ext pixel (u, v) shows west pixel (u + x, v + y). Nano Banana redraws the strip it
// was given, sometimes a little shifted, so search near where the starter put it: coarse at a quarter size, then exact.
function align(west: Img, ext: Img, guessX: number, strip: [number, number]): { x: number; y: number; score: number } {
  const search = (f: number, cx: number, cy: number, rx: number, ry: number, step: number) => {
    const A = gray(west, f), B = gray(ext, f), u0 = Math.round(strip[0] / f), u1 = Math.round(strip[1] / f);
    const gx = Math.round(cx / f), gy = Math.round(cy / f);
    let best = { x: cx, y: cy, score: Infinity };
    for (let dy = gy - ry; dy <= gy + ry; dy++) for (let dx = gx - rx; dx <= gx + rx; dx++) {
      let sum = 0, n = 0;
      for (let v = 0; v < B.h; v += step) {
        const wy = v + dy;
        if (wy < 0 || wy >= A.h) continue;
        for (let u = u0; u < u1; u += step) {
          const wx = u + dx;
          if (wx < 0 || wx >= A.w) continue;
          sum += Math.abs(B.d[v * B.w + u] - A.d[wy * A.w + wx]);
          n++;
        }
      }
      if (n > 200 && sum / n < best.score) best = { x: dx * f, y: dy * f, score: sum / n };
    }
    return best;
  };
  const coarse = search(4, guessX, 0, Math.round((west.w * 0.06) / 4), Math.round((west.h * 0.04) / 4), 2);
  return search(1, coarse.x, coarse.y, 4, 4, 3);
}

const westFile = find('west');
if (!westFile) throw new Error(`no ${DIR}/west.jpg or .png`);
const west = load(westFile);
const northFile = find('north'), southFile = find('south');
const north = northFile ? load(northFile) : null, south = southFile ? load(southFile) : null;
const O = Math.floor(west.w * STARTER_STRIP);
const nAt = north ? align(west, north, west.w - O, [0, O * 0.9]) : null;
const sAt = south ? align(west, south, -(south.w - O), [south.w - O * 0.9, south.w]) : null;
console.log(`west ${west.w}x${west.h}` + (nAt ? `; north at ${nAt.x},${nAt.y} (diff ${nAt.score.toFixed(1)})` : '') + (sAt ? `; south at ${sAt.x},${sAt.y} (diff ${sAt.score.toFixed(1)})` : ''));

// Each picture with its magenta cut out, premultiplied (r, g, b times alpha, then alpha), so blending never mixes sky
// into land.
function keyed(img: Img): Float32Array {
  const out = new Float32Array(img.w * img.h * 4), p = img.p;
  for (let i = 0; i < out.length; i += 4) {
    let r = p[i], g = p[i + 1], b = p[i + 2];
    const m = Math.min(r, b) - g; // how far red and blue both sit above green: magenta
    const a = 1 - smooth(45, 120, m);
    if (a < 1 && m > 0) {
      r -= m;
      b -= m;
    }
    out[i] = r * a;
    out[i + 1] = g * a;
    out[i + 2] = b * a;
    out[i + 3] = a * 255;
  }
  return out;
}

// One strip: west, then north and south laid over it. Each joins west along the seam through the overlap where the
// two agree best (a path top to bottom that may wander a pixel a row), softened over FEATHER pixels, so a peak one
// picture drew and the other didn't is either kept whole or left out, never cut in half.
const FEATHER = 14;
const x0 = sAt ? sAt.x : 0, x1 = north && nAt ? nAt.x + north.w : west.w, H = west.h, W = x1 - x0;
const S = new Float32Array(W * H * 4);
const kw = keyed(west);
for (let y = 0; y < H; y++) S.set(kw.subarray(y * west.w * 4, (y + 1) * west.w * 4), (y * W - x0) * 4);
function join(img: Img, at: { x: number; y: number }, extOnRight: boolean): void {
  const k = keyed(img);
  // the overlap in strip x, with a margin so the soft edge stays inside it
  const lo = Math.max(at.x, 0) - x0, hi = Math.min(at.x + img.w, west.w) - x0, a = lo + FEATHER + 4, b = hi - FEATHER - 4, n = b - a;
  const ext = (x: number, y: number) => ((y - at.y) * img.w + (x + x0 - at.x)) * 4;
  const rowOk = (y: number) => y - at.y >= 0 && y - at.y < img.h;
  const cost = new Float32Array(n * H), from = new Int8Array(n * H);
  for (let y = 0; y < H; y++) for (let i = 0; i < n; i++) {
    const x = a + i, s = (y * W + x) * 4;
    let c = 0;
    if (rowOk(y)) {
      const e = ext(x, y);
      c = Math.abs(S[s] - k[e]) + Math.abs(S[s + 1] - k[e + 1]) + Math.abs(S[s + 2] - k[e + 2]) + Math.abs(S[s + 3] - k[e + 3]);
    }
    if (y > 0) {
      let best = cost[(y - 1) * n + i], step = 0;
      if (i > 0 && cost[(y - 1) * n + i - 1] < best) { best = cost[(y - 1) * n + i - 1]; step = -1; }
      if (i < n - 1 && cost[(y - 1) * n + i + 1] < best) { best = cost[(y - 1) * n + i + 1]; step = 1; }
      c += best;
      from[y * n + i] = step;
    }
    cost[y * n + i] = c;
  }
  const seam = new Int32Array(H);
  let i = 0;
  for (let j = 1; j < n; j++) if (cost[(H - 1) * n + j] < cost[(H - 1) * n + i]) i = j;
  for (let y = H - 1; y >= 0; y--) {
    seam[y] = a + i;
    i += from[y * n + i];
  }
  for (let y = 0; y < H; y++) {
    if (!rowOk(y)) continue;
    for (let u = 0; u < img.w; u++) {
      const x = u + at.x - x0;
      const t = smooth(seam[y] - FEATHER, seam[y] + FEATHER, x), w = extOnRight ? t : 1 - t;
      if (w <= 0) continue;
      const s = (y * W + x) * 4, e = ((y - at.y) * img.w + u) * 4;
      for (let c = 0; c < 4; c++) S[s + c] = S[s + c] * (1 - w) + k[e + c] * w;
    }
  }
  console.log(`  seam ${extOnRight ? 'north' : 'south'}: x ${Math.min(...seam) + x0}..${Math.max(...seam) + x0} (west px)`);
}
if (north && nAt) join(north, nAt, true);
if (south && sAt) join(south, sAt, false);

// back to straight alpha, haze, fade the far ends, find the top
const strip: Img = { w: W, h: H, p: new Uint8ClampedArray(W * H * 4) };
const edge = W * 0.004; // just enough to soften the last column; the ends sink instead (below)
let top = H;
for (let y = 0; y < H; y++) {
  let solid = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, al = S[i + 3] / 255, p = strip.p;
    const un = al > 0.004 ? 1 / al : 0;
    const a = al * smooth(0, edge, x) * smooth(0, edge, W - 1 - x);
    p[i] = S[i] * un * (1 - HAZE_SHARE) + HAZE[0] * HAZE_SHARE;
    p[i + 1] = S[i + 1] * un * (1 - HAZE_SHARE) + HAZE[1] * HAZE_SHARE;
    p[i + 2] = S[i + 2] * un * (1 - HAZE_SHARE) + HAZE[2] * HAZE_SHARE;
    p[i + 3] = a * 255;
    if (a > 0.5) solid++;
  }
  if (top === H && solid > W * 0.002) top = Math.max(0, y - 4);
}
const cut = Math.round(H * TRIM_BOTTOM), h1 = H - cut - top;
const final: Img = { w: W, h: h1, p: strip.p.slice(top * W * 4, (top + h1) * W * 4) };

// The far ends sink below the horizon instead of fading in mid-air: across the last SINK share of the width at each
// end, each column slides down, a little more toward the end, until nothing is left above the bottom. The game's own
// far hills hide what's below. Faded hills hung in the sky like a ghost band.
const SINK = 0.15, zone = Math.round(W * SINK);
const landTop = (x: number) => {
  for (let y = 0; y < h1; y++) if (final.p[(y * W + x) * 4 + 3] > 128) return y;
  return h1;
};
let tallest = 0;
for (let x = 0; x < zone; x++) tallest = Math.max(tallest, h1 - landTop(x), h1 - landTop(W - 1 - x));
for (let x = 0; x < W; x++) {
  const s = 1 - smooth(0, zone, Math.min(x, W - 1 - x));
  const shift = Math.round(s * (tallest + 2));
  if (shift <= 0) continue;
  for (let y = h1 - 1; y >= 0; y--) {
    const d = (y * W + x) * 4, from = y - shift;
    if (from >= 0) final.p.copyWithin(d, (from * W + x) * 4, (from * W + x) * 4 + 4);
    else final.p.fill(0, d, d + 4);
  }
}
console.log(`  ends sink over ${zone} px each, up to ${tallest} px`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const chunks: { file: string; x: number; w: number }[] = [];
for (let x = 0, i = 0; x < W; x += MAX_TEX, i++) {
  const w = Math.min(MAX_TEX, W - x), file = `${i}.png`;
  save(final, x, w, `${OUT}/${file}`);
  chunks.push({ file, x, w });
}
// center: west's middle in strip pixels; westW: west's width, which covers the game's SPAN
const info = { width: W, height: h1, center: west.w / 2 - x0, westW: west.w, chunks };
writeFileSync(`${OUT}/info.json`, JSON.stringify(info, null, 2) + '\n');
console.log(`baked ${W}x${h1} into ${chunks.length} pieces in ${OUT}/`);
