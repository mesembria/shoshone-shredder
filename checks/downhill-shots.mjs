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
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=bolinas&at=Climb' });
await sleep(2500);
await sleep(3000);
const C = await ev(`(() => { const c = window.__lab.course.climb; return { ledges: c.ledges.map((l) => ({ x: l.pos.x, z: l.pos.z, dir: l.dir })), loose: c.loose, area: c.area, top: c.top.a.x }; })()`);
console.log(JSON.stringify(C));
const go = async (x, z, yaw) => {
  const tp = (y) => ev(`(() => { const L = window.__lab, V = L.s.pos.constructor; L.course.stations.tmp = { pos: new V(${x}, ${'${y}'}, ${z}), yaw: ${yaw} }; L.teleport('tmp'); })()`.replace('${y}', y));
  await tp(15); await sleep(400); await until(`window.__lab.s.grounded`, 6000);
  const y = await ev(`window.__lab.s.pos.y + 0.02`);
  await tp(y); await sleep(1500);
};
const sw3 = C.area[2].x1;
const logX = C.ledges.find((l) => l.log)?.x ?? 69.7;
await sleep(2000);
const hint = () => ev(`[...document.querySelectorAll('.jumpbtn .tricks')].map((e) => e.textContent).join(' | ')`);
await go(sw3 - 1.5, 91, Math.PI); await shot('a0-summit');
await go(99.5, 91, Math.PI); await shot('a1-jump1');
await go(86, 91, Math.PI); await shot('a2-rocks');
await go(logX + 3.8, 91, Math.PI); await sleep(200); console.log('log hint:', await hint()); await shot('a3-log');
await go(logX - 2.2, 91, Math.PI); await shot('a4-drop');
await go(61, 91, Math.PI); await shot('a5-jump2');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
ws.close(); chrome.kill();
