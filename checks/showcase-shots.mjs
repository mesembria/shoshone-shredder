// Screenshots of the four showcase places from their stations (and a step along each), for a look. Usage: node checks/showcase-shots.mjs [dir]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = process.argv[2] ?? mkdtempSync(`${tmpdir()}/shredder-check-`); // screenshots go in SP/shots
mkdirSync(`${SP}/shots`, { recursive: true });
console.log('screenshots:', `${SP}/shots`);
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = spawn(BIN, ['--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9342/json')).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(); const errs = [];
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errs.push(msg.params.args.map((a) => a.value ?? a.description).join(' ')); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) console.log('EVAL ERR', e.slice(0, 80), r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/shots/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(20); } return false; };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
// each place: just after the start, then after riding on (stick untouched: cruise) for a few seconds of game time
let n = 0;
for (const at of ['Rhythm', 'Rock chute', 'Switchbacks', 'Jumps XL']) {
  await send('Page.navigate', { url: `http://127.0.0.1:5173/play.html?bike=bolinas&at=${encodeURIComponent(at)}` });
  await until(`!!window.__lab && window.__lab.s.clock > 0.5`, 20000);
  for (const t of [1.5, 5, 9]) {
    await until(`window.__lab.s.clock > ${t}`, 30000);
    await shot(`${String(++n).padStart(2, '0')}-${at.replace(/ /g, '-')}-${t}s`);
  }
}
console.log(errs.length ? `errors: ${errs.slice(0, 3).join(' | ')}` : 'errors: none');
chrome.kill();
