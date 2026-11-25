// The hub screens' buttons (Who's riding, the map and its sheet, the Garage, the Shop) press while another finger is
// on the glass (a palm resting on the edge of the iPad). A tap made then never becomes a click, so these go through
// bindPresses (src/input/press.ts) like the ride's buttons do (see checks/menu-taps.mjs). Also: a tap on the sheet's
// backdrop, which is no button, still closes it. Each screen gets a fresh Chrome (touch input stops reaching a page
// after the session navigates). Needs the dev server on 127.0.0.1:5173. Prints PASS or FAIL per case.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = mkdtempSync(`${tmpdir()}/shredder-hubtaps-`);
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = 820, rest = [8, H / 2], P = 9; // the palm, down for the whole case
let fails = 0;
const expect = (name, ok, got) => { console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(got)); if (!ok) fails++; };

async function session(port, query, run) {
  const chrome = spawn(BIN, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const waiting = new Map(); const errs = [];
  ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(15); } return false; };
  const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, i]) => ({ x, y, id: i, radiusX: 12, radiusY: 12 })) });
  const centre = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width) return null; return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  let f = 10;
  // a second finger taps at [x, y] while the palm stays down
  const tapWithPalm = async (at) => {
    if (!at) return;
    await touch('touchStart', [[...rest, P], [...at, ++f]]);
    await sleep(70);
    await touch('touchEnd', [[...at, f]]);
    await sleep(350);
  };
  const tapAlone = async (at) => {
    if (!at) return;
    await touch('touchStart', [[...at, ++f]]);
    await sleep(70);
    await touch('touchEnd', []);
    await sleep(350);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: H, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: `http://127.0.0.1:5173/play.html${query}` });
  await sleep(1200);
  await touch('touchStart', [[...rest, P]]); // the palm lands
  await sleep(100);
  await run({ ev, until, centre, touch, tapWithPalm, tapAlone });
  expect(`no errors (${query || 'who'})`, errs.length === 0, errs);
  ws.close(); chrome.kill();
  await sleep(500);
}

// Who's riding: ✎ opens the name box, Ride! opens that rider's map
await session(9341, '', async ({ ev, until, centre, tapWithPalm }) => {
  await until(`document.querySelectorAll('#who .rider').length === 2`);
  await tapWithPalm(await centre('#who .rider[data-i="0"] .rename'));
  expect('✎ rename opens the name box with a palm on the glass', !!(await ev(`document.querySelector('#who .rider[data-i="0"] input')`)), null);
  await ev(`document.querySelector('#who .rider[data-i="0"] input').blur()`);
  await tapWithPalm(await centre('#who .rider[data-i="0"] .go'));
  expect('Ride! goes to the rider\'s map with a palm on the glass', await until(`location.search === '?rider=0'`, 5000), await ev('location.search'));
});

// the map: a pin opens its sheet, ✕ closes it, a tap on the backdrop closes it, the Garage pin goes to the Garage
await session(9342, '?rider=0', async ({ ev, until, centre, touch, tapWithPalm, tapAlone }) => {
  await until(`!!document.querySelector('#hub .pin.area')`);
  await sleep(500);
  const sheetOpen = () => ev(`!document.querySelector('#hub .sheet').hidden`);
  await tapWithPalm(await centre('#hub .pin.area'));
  expect('an area pin opens its sheet with a palm on the glass', await sheetOpen(), null);
  await tapWithPalm(await centre('#hub .sheet .close'));
  expect('the sheet\'s ✕ closes it with a palm on the glass', !(await sheetOpen()), null);
  await tapWithPalm(await centre('#hub .pin.area'));
  const at = await ev(`(() => { const r = document.querySelector('#hub .scrim').getBoundingClientRect(); return [r.x + 6, r.y + 6]; })()`);
  await touch('touchEnd', []); // the palm lifts: a backdrop tap is no button, so it closes through a click, and with a palm down there is none
  await sleep(200);
  expect('the sheet is open before the backdrop tap', await sheetOpen(), null);
  await tapAlone(at);
  expect('a lone tap on the backdrop still closes the sheet', !(await sheetOpen()), null);
  await touch('touchStart', [[...rest, P]]);
  await tapWithPalm(await centre('#hub .pin.home[data-place="garage"]'));
  expect('the Garage pin goes to the Garage with a palm on the glass', await until(`location.search === '?rider=0&view=garage'`, 5000), await ev('location.search'));
});

// the Garage: a tab switches
await session(9343, '?rider=0&view=garage', async ({ ev, until, centre, tapWithPalm }) => {
  await until(`!!document.querySelector('#hub .garage .tab')`);
  await sleep(500);
  await tapWithPalm(await centre('#hub .garage .tab[data-tab="paint"]'));
  expect('a Garage tab switches with a palm on the glass', !!(await ev(`document.querySelector('#hub .garage .tab[data-tab="paint"]').classList.contains('on')`)), null);
  await tapWithPalm(await centre('#hub .garage .back'));
  expect('the Garage\'s back button goes to the map with a palm on the glass', await until(`location.search === '?rider=0'`, 5000), await ev('location.search'));
});

// the Shop: a tab switches
await session(9344, '?rider=0&view=shop', async ({ ev, until, centre, tapWithPalm }) => {
  await until(`!!document.querySelector('#hub .shop .tab')`);
  await sleep(500);
  await tapWithPalm(await centre('#hub .shop .tab[data-tab="parts"]'));
  expect('a Shop tab switches with a palm on the glass', !!(await ev(`document.querySelector('#hub .shop .tab[data-tab="parts"]').classList.contains('on')`)), null);
});

process.exit(fails ? 1 : 0);
