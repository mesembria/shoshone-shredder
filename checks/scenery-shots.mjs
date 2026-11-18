// Screenshots: pump track, pumping, a backflip and a 360 mid-air (slow motion), driven with real touches.
import { spawn } from 'node:child_process';
import { statSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = process.argv[2] ?? mkdtempSync(`${tmpdir()}/shredder-check-`); // screenshots go in SP/shots
mkdirSync(`${SP}/shots`, { recursive: true });
console.log('screenshots:', `${SP}/shots`);
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = spawn(BIN, ['--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9341/json')).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(); const errs = [];
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, i]) => ({ x, y, id: i, radiusX: 12, radiusY: 12 })) });
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/shots/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(15); } return false; };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const jobs = process.argv[3] ? [[process.argv[3], 0]] : [['Trailhead', 0], ['Hilltop', 0], ['Hilltop', 1.5], ['Hilltop', -1.5], ['Shoulder', 0], ['Park lot', 0], ['Start hill', 0]];
const places = [['Trailhead', 'hill'], ['Park lot', 'park']];
if (process.argv[3] === 'bound') {
  for (const [at, name] of places) {
    await send('Page.navigate', { url: `http://127.0.0.1:5173/play.html?bike=bolinas&at=${encodeURIComponent(at)}&debug` });
    await sleep(6000);
    // 12 m inside the +x boundary, facing it, from the middle of the extent's z
    await ev(`(() => { const L = window.__lab, b = L.course.scenery.bound, e = L.course.scenery.extent, V = L.s.pos.constructor; L.course.stations.tmp = { pos: new V(b.x1 - 14, ${name === 'park' ? 0.04 : 0.04}, ${name === 'park' ? 20 : 'e.z0 + 30'}), yaw: 0 }; L.teleport('tmp'); })()`);
    await sleep(3000);
    const info = await ev(`(() => { const r = window.__lab.look.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, pos: window.__lab.s.pos, bound: window.__lab.course.scenery.bound }; })()`);
    console.log('boundary-' + name, JSON.stringify(info));
    await shot('warmup'); await sleep(1500);
    for (let k = 0; k < 4; k++) { await shot('boundary-' + name); if (statSync(`${SP}/shots/boundary-${name}.png`).size > 200000) break; await sleep(2000); }
  }
  chrome.kill(); process.exit(0);
}
for (const [at, turn] of jobs) {
  await send('Page.navigate', { url: `http://127.0.0.1:5173/play.html?bike=bolinas&at=${encodeURIComponent(at)}&debug` });
  await sleep(6000);
  await ev(`(() => { const s = window.__lab.s; s.yaw = ${turn}; })()`);
  await sleep(2500);
  const info = await ev(`(() => { const r = window.__lab.look.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, y: window.__lab.s.pos.y }; })()`);
  await shot('warmup'); await sleep(1500); // the first capture after a load can come back blank in headless
  const name = `${at.replace(' ', '-')}${turn ? (turn > 0 ? '-left' : '-right') : ''}`;
  console.log(name, JSON.stringify(info));
  for (let k = 0; k < 4; k++) { await shot(name); if (statSync(`${SP}/shots/${name}.png`).size > 200000) break; await sleep(2000); } // a capture can come back blank in headless
  await ev('0');
}
console.log('errors', JSON.stringify(errs));
chrome.kill(); process.exit(0);
