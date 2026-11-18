// Screenshots: pump track, pumping, a backflip and a 360 mid-air (slow motion), driven with real touches.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = process.argv[2] ?? mkdtempSync(`${tmpdir()}/shredder-check-`); // screenshots go in SP/shots
mkdirSync(`${SP}/shots`, { recursive: true });
console.log('screenshots:', `${SP}/shots`);
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = spawn(BIN, ['--headless=new', '--remote-debugging-port=9337', `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9337/json')).json(); break; } catch { await sleep(250); } }
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
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=dirtjumper&at=Pump%20track&slow=0.35' });
await sleep(2500);
await sleep(2500);
await ev(`window.__lab.teleport('Pump track')`);
// first downhill: hint, then hold to pump
console.log('downhill hint:', await until(`window.__lab.s.grounded && window.__lab.s.slope < -0.06`), JSON.stringify(await ev(`[...document.querySelectorAll('.jumpbtn .tricks')].map((e) => e.textContent)`)));
await shot('30-pumptrack-hint');
await touch('touchStart', [[W - 130, row, 1]]);
console.log('pumping:', await until(`document.querySelector('.jumpbtn').classList.contains('pump')`));
await shot('31-pumping');
await touch('touchEnd', []);
// into the banked turn
await ev(`(() => { const s = window.__lab.s; s.pos.set(16 + 5.5 * Math.sin(0.5), 0.3, 90 - 5.5 * Math.cos(0.5)); s.yaw = -0.5; s.speed = 7; })()`);
await sleep(700);
await shot('32-berm');
// backflip and 360 off the medium jump, swiped with a real touch just after takeoff
for (const [name, dx, dy] of [['33-backflip', 0, 90], ['34-spin', -90, 0]]) {
  await ev(`window.__lab.teleport('Jumps M')`);
  await ev(`(() => { const s = window.__lab.s; s.pos.x = -31; s.speed = 9.5; })()`);
  await until(`!window.__lab.s.grounded && window.__lab.s.air && window.__lab.s.air.t > 0.05`);
  // a real-speed swipe (headless touch events arrive too slowly to count as one)
  await ev(`(() => { const c = document.querySelector('canvas'); const o = { pointerId: 77, pointerType: 'touch', bubbles: true, clientX: ${W - 130}, clientY: ${row} };
    const to = { ...o, clientX: o.clientX + ${dx}, clientY: o.clientY + ${dy} };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); window.dispatchEvent(new PointerEvent('pointermove', to)); window.dispatchEvent(new PointerEvent('pointerup', to)); })()`);
  const ok = await until(`(() => { const m = window.__lab.s.move; return m && m.t > 0.38 })()`);
  await shot(name);
  await until(`window.__lab.s.grounded || window.__lab.s.crash`, 10000);
  await sleep(200);
  console.log(name, 'started:', ok, 'landed:', JSON.stringify(await ev(`({ crash: window.__lab.s.crash?.outcome ?? null, combo: document.querySelector('#hud .combo')?.textContent })`)));
}
console.log('errors:', errs.length ? errs.join('\n') : 'none');
ws.close(); chrome.kill();
