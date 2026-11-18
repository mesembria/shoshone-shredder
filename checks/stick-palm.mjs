// The stick keeps its thumb when a palm or the base of the thumb brushes the bottom-left corner while steering
// right, and a touch back on the stick still takes over from a thumb whose lift iPadOS swallowed. Needs the dev
// server on 127.0.0.1:5173. Prints PASS or FAIL per case.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = process.argv[2] ?? mkdtempSync(`${tmpdir()}/shredder-check-`); // screenshots go in SP/shots
mkdirSync(`${SP}/shots`, { recursive: true });
console.log('screenshots:', `${SP}/shots`);
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = spawn(BIN, ['--headless=new', '--remote-debugging-port=9338', `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9338/json')).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(); const errs = [];
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, i]) => ({ x, y, id: i, radiusX: 12, radiusY: 12 })) });
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/shots/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(15); } return false; };
const W = 1180, row = 820 * 0.62;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
const H = 820, home = [130, H * 0.62];
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=dirtjumper' });
await until(`!!window.__lab`, 15000);
await sleep(1000);
const left = () => ev(`(() => { const t = window.__lab.pad.thumbs().left; return t && { id: t.id, x: t.x, y: t.y }; })()`);
const knob = () => ev(`document.querySelector('.stick .knob').style.transform`);
let fails = 0;
const expect = (name, ok, got) => { console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(got)); if (!ok) fails++; };

// 1. real touches: thumb steers right, then a palm lands in the bottom-left corner
await touch('touchStart', [[home[0], home[1], 1]]);
await sleep(100);
await touch('touchMove', [[home[0] + 50, home[1], 1]]);
await sleep(100);
const thumb = await left();
await touch('touchStart', [[home[0] + 60, home[1], 1], [30, 790, 2]]);
await sleep(150);
await touch('touchMove', [[home[0] + 70, home[1], 1], [30, 790, 2]]);
await touch('touchMove', [[home[0] + 70, home[1], 1], [30, 791, 2]]); // headless Chrome holds back a move until the next one
await sleep(150);
const after = await left();
expect('palm in the corner leaves the thumb on the stick', after && after.id === thumb.id && after.x === home[0] + 70, after);
const k = await knob();
expect('knob stays pushed right', /^translate\(70(\.0)?px, 0(\.0)?px\)$/.test(k), k);
await shot('stick-palm');
await touch('touchEnd', []);
await sleep(200);
expect('everything lets go after the lift', (await left()) === null, await left());

// 2. a thumb whose lift never arrived (pointer events only, so the finger-count guard can't see it), then a new
//    touch: one in the corner is ignored, one back on the stick takes over
const pd = (id, x, y) => ev(`document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { pointerId: ${id}, pointerType: 'touch', bubbles: true, clientX: ${x}, clientY: ${y} }))`);
await pd(50, home[0] + 40, home[1]);
await pd(51, 30, 790);
expect('corner touch does not take the stuck stick', (await left())?.id === 50, await left());
await pd(52, home[0] + 10, home[1] + 20);
expect('touch on the stick takes over a stuck thumb', (await left())?.id === 52, await left());
await ev(`for (const id of [50, 51, 52]) window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch' }))`);

console.log('errors:', errs.length ? errs.join('\n') : 'none');
ws.close(); chrome.kill();
process.exit(fails || errs.length ? 1 : 0);
