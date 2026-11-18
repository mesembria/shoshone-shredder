// UI art: turns the keyed masters in art/ui/keyed/ into the small WebP files the game loads from public/ui/, and cuts the
// magenta background out of a new Nano Banana picture. All pixel work runs in a headless Chromium canvas (no image
// libraries in the project).
//   node art/ui/build.mjs                      build public/ui/*.webp from art/ui/keyed/*.png
//   node art/ui/build.mjs key <in> <out.png>   cut the magenta out of one picture (trimmed to what's left)
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';

const KEYED = 'art/ui/keyed', OUT = 'public/ui';
// Display sizes are about half these (2x for the iPad's retina screen)
const JOBS = [
  // the sign stretches sideways: two ends and a plain middle slice, all 160 px tall (ends 165 px of the 1400x400 master)
  { from: 'sign', to: 'sign-l', crop: (w, h) => [0, 0, 165, h], height: 160 },
  { from: 'sign', to: 'sign-m', crop: (w, h) => [Math.round(w / 2 - 32), 0, 64, h], height: 160 },
  { from: 'sign', to: 'sign-r', crop: (w, h) => [w - 165, 0, 165, h], height: 160 },
  { from: 'star-gold', to: 'star-gold', height: 160 },
  // the stone star kept a pink cast from the magenta: bake grey in (the mockups used saturate(0) brightness(1.06))
  { from: 'star-empty', to: 'star-empty', height: 160, grey: 1.06 },
  { from: 'cog', to: 'cog', height: 96 },
  { from: 'hill-up', to: 'hill-up', width: 160 },
  { from: 'hill-down', to: 'hill-down', width: 160 },
  { from: 'hill-both', to: 'hill-both', width: 160 },
];

const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const profile = mkdtempSync(`${tmpdir()}/ui-art-`);
const chrome = spawn(BIN, ['--headless=new', '--remote-debugging-port=9351', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch('http://127.0.0.1:9351/json')).json(); } catch { await sleep(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map();
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.result.value;
};

// The page side: load a data URL, then crop / key / grey / scale on a canvas and hand back a data URL
await ev(`(() => {
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  window.load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  window.canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // the cut-out: alpha from how magenta a pixel is (a tightened edge), then any magenta cast pulled back to neutral,
  // then trimmed to what's left
  window.key = async (src) => {
    const img = await load(src), c = canvasOf(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], gr = p[i + 1], b = p[i + 2], lo = Math.min(r, b), m = lo - gr;
      const a = 255 * (1 - clamp01((m - 50) / 110)) ** 1.6;
      if (lo > gr) { p[i] = r - (lo - gr); p[i + 2] = b - (lo - gr); }
      p[i + 3] = Math.min(p[i + 3], a);
      if (p[i + 3] > 24) { const k = i / 4, x = k % c.width, y = (k / c.width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    g.putImageData(d, 0, 0);
    const t = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
    t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
    return t.toDataURL('image/png');
  };
  window.build = async (src, job) => {
    const img = await load(src);
    const [sx, sy, sw, sh] = job.crop ?? [0, 0, img.width, img.height];
    const w = job.width ?? Math.round((sw * job.height) / sh), h = job.height ?? Math.round((sh * job.width) / sw);
    const c = canvasOf(w, h), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    if (job.grey) {
      const d = g.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const l = Math.min(255, (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) * job.grey); p[i] = p[i + 1] = p[i + 2] = l; }
      g.putImageData(d, 0, 0);
    }
    return c.toDataURL('image/webp', 0.85);
  };
})()`);

const dataUrl = (f) => `data:image/${extname(f) === '.png' ? 'png' : 'jpeg'};base64,${readFileSync(f).toString('base64')}`;
const save = (f, url) => writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
const size = async (f) => ev(`load(${JSON.stringify(dataUrl(f))}).then((i) => [i.width, i.height])`);

try {
  if (process.argv[2] === 'key') {
    const [, , , from, to] = process.argv;
    save(to, await ev(`key(${JSON.stringify(dataUrl(from))})`));
    console.log('keyed', from, '→', to);
  } else {
    for (const j of JOBS) {
      const from = `${KEYED}/${j.from}.png`, [w, h] = await size(from);
      const job = { ...j, crop: j.crop?.(w, h) };
      const to = `${OUT}/${j.to}.webp`;
      save(to, await ev(`build(${JSON.stringify(dataUrl(from))}, ${JSON.stringify(job)})`));
      console.log(to, `${(readFileSync(to).length / 1024).toFixed(1)} KB`);
    }
  }
} finally {
  chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}
