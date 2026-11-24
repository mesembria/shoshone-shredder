// The ride's buttons (🗺 Map, 📍, Ride ▶, Swap, Stop) press while a thumb is on the stick. A tap made while another
// finger is on the glass never becomes a click (iPad Safari and Chrome alike): it only fires pointerdown and pointerup
// on the button. Also: a lone tap presses once, a finger that slides off doesn't press, and a mouse click still
// works. Needs the dev server on 127.0.0.1:5173. Prints PASS or FAIL per case.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = process.argv[2] ?? mkdtempSync(`${tmpdir()}/shredder-check-`);
mkdirSync(SP, { recursive: true });
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = spawn(BIN, ['--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9339/json')).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(); const errs = [];
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
// CDP touches: touchStart and touchMove list every finger down; touchEnd lists the fingers that lift ([] lifts them all)
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, i]) => ({ x, y, id: i, radiusX: 12, radiusY: 12 })) });
const mouse = async (x, y) => {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
};
const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(15); } return false; };
const H = 820, home = [130, H * 0.62];
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: H, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
// ?bike= owns every bike (so Swap shows) and has no welcome card
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=dirtjumper' });
await until(`!!window.__game && !!document.querySelector('#lab .m-area')`, 20000);
await sleep(800);
let fails = 0;
const expect = (name, ok, got) => { console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(got)); if (!ok) fails++; };
const centre = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width) return null; return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
const modal = () => ev(`window.__game.modal()`);
const bike = () => ev(`window.__lab.bike()`);
const T = 1; // the thumb on the stick
const thumbDown = async () => {
  await touch('touchStart', [[...home, T]]);
  await sleep(80);
  await touch('touchMove', [[home[0] + 40, home[1] - 30, T]]);
  await touch('touchMove', [[home[0] + 41, home[1] - 30, T]]); // headless Chrome holds back a move until the next one
  await sleep(250);
};
// a second finger taps at [x, y] while the thumb stays on the stick
// (a button that isn't showing: nothing to tap, and the case after it says so)
const tapBeside = async (at, f) => {
  if (!at) return;
  const [x, y] = at;
  await touch('touchStart', [[home[0] + 41, home[1] - 30, T], [x, y, f]]);
  await sleep(70);
  await touch('touchEnd', [[x, y, f]]);
  await sleep(350);
};
const tapAlone = async (at, f) => {
  if (!at) return;
  const [x, y] = at;
  await touch('touchStart', [[x, y, f]]);
  await sleep(70);
  await touch('touchEnd', []);
  await sleep(350);
};

// 1. with the thumb steering: 📍 opens the area list, Ride ▶ closes it, Swap swaps
await thumbDown();
expect('the thumb is on the stick', !!(await ev(`!!window.__lab.pad.thumbs().left`)), null);
await tapBeside(await centre('#lab .m-area'), 2);
expect('📍 opens the area list with a thumb on the stick', (await modal()) === 'sheet', await modal());
await tapBeside(await centre('#lab .sheet .close'), 3);
expect('Ride ▶ closes it with a thumb on the stick', (await modal()) === null, await modal());
const b0 = await bike();
await tapBeside(await centre('#lab .swap'), 4);
const b1 = await bike();
expect('Swap swaps with a thumb on the stick', b1 !== b0, { b0, b1 });

// 2. Stop, in a run, with the thumb steering
await touch('touchEnd', []);
await sleep(200);
await ev(`window.__game.start('goatUp')`);
await until(`window.__game.run() !== null`, 5000);
await thumbDown();
await tapBeside(await centre('#lab .b-stop'), 5);
expect('Stop ends the run with a thumb on the stick', (await ev(`window.__game.run() === null`)) === true, await ev(`window.__game.run()?.def.id`));
await touch('touchEnd', []);
await ev(`window.__game.run() && document.querySelector('#lab .b-stop').click()`); // (if Stop failed: the rest needs the menu back)
await sleep(300);

// 3. a lone tap presses once: Swap goes to the next bike, not the one after (the click after the lift is ignored).
//    One swap from x0 lands on x1; swap on round back to x0, then tap
const x0 = await bike();
await ev(`window.__lab.swap()`);
const x1 = await bike();
await ev(`(() => { for (let i = 0; i < 20 && window.__lab.bike() !== ${JSON.stringify(x0)}; i++) window.__lab.swap(); })()`);
await tapAlone(await centre('#lab .swap'), 6);
expect('a lone tap on Swap swaps once', (await bike()) === x1, { x0, x1, got: await bike() });

// 4. a finger that lands on 📍 and slides off before lifting doesn't press it
const [ax, ay] = (await centre('#lab .m-area')) ?? [0, 0];
await touch('touchStart', [[ax, ay, 7]]);
await sleep(60);
await touch('touchMove', [[ax - 200, ay + 250, 7]]);
await touch('touchMove', [[ax - 201, ay + 250, 7]]);
await sleep(60);
await touch('touchEnd', []);
await sleep(350);
expect('sliding off 📍 does not open the list', (await modal()) === null, await modal());

// 5. a mouse click still presses (the grown-up at the Mac)
await mouse(...((await centre('#lab .m-area')) ?? [0, 0]));
await sleep(300);
expect('a mouse click on 📍 opens the list', (await modal()) === 'sheet', await modal());
await mouse(...((await centre('#lab .sheet .close')) ?? [0, 0]));
await sleep(300);
expect('a mouse click on Ride ▶ closes it', (await modal()) === null, await modal());

// 6. last (it leaves the page): 🗺 Map with the thumb steering goes to Who's riding (?bike= has no rider of its own)
await thumbDown();
await tapBeside(await centre('#lab .m-map'), 8);
const left = await until(`location.search === ''`, 5000);
expect('🗺 Map leaves the ride with a thumb on the stick', left, await ev(`location.search`));

console.log('errors:', errs.length ? errs.join('\n') : 'none');
ws.close(); chrome.kill();
process.exit(fails || errs.length ? 1 : 0);
