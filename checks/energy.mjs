// Browser check: the energy ring round the stick. Holding the stick up on the dirt jumper empties it and says "Burnt!",
// letting go refills it. Prints PASS/FAIL lines; exits non-zero on any FAIL.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
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
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errs.push(msg.params.args.map((a) => a.value ?? a.description).join(' ')); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) console.log('EVAL ERR', e.slice(0, 80), r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/shots/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(20); } return false; };
const click = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'missing ' + ${JSON.stringify(sel)}; b.click(); return 'ok'; })()`);
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`);
const W = 1180, row = 820 * 0.62;
const swipe = (dx, dy) => ev(`(() => { const c = document.querySelector('canvas'); const o = { pointerId: 77, pointerType: 'touch', bubbles: true, clientX: ${W - 130}, clientY: ${row} };
  const to = { ...o, clientX: o.clientX + ${dx}, clientY: o.clientY + ${dy} };
  c.dispatchEvent(new PointerEvent('pointerdown', o)); window.dispatchEvent(new PointerEvent('pointermove', to)); window.dispatchEvent(new PointerEvent('pointerup', to)); })()`);
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) fails++; };

const callout = () => text('#hud .callout');

// ---- the energy ring: hold the stick up on the dirt jumper until it's burnt, then let go and watch it refill
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=dirtjumper&at=Street' });
check(await until(`!!window.__lab && !!document.querySelector('#lab .stick .fuel')`, 15000), 'page up, with an energy ring on the stick');
// an arc over the top of the stick, where a big thumb on the knob doesn't cover it
const arc = await ev(`(() => { const f = document.querySelector('#lab .stick .fuel'), s = document.querySelector('#lab .stick').getBoundingClientRect(), r = f.getBoundingClientRect(); return { inKnob: !!f.closest('.knob'), above: r.top < s.top - 4, centered: Math.abs((r.left + r.right) / 2 - (s.left + s.right) / 2) < 3 }; })()`);
check(arc && !arc.inKnob && arc.above && arc.centered, `the energy arc sits over the stick, not under the thumb (${JSON.stringify(arc)})`);
await sleep(500);
const fuel = () => ev(`parseFloat(getComputedStyle(document.querySelector('#lab .stick .fuel')).getPropertyValue('--e')) / 360`);
check((await fuel()) > 0.98, `the ring starts full (${await fuel()})`);
await shot('energy-full');
const stickAt = { x: 130, y: row };
const touch = (type, x, y) => ev(`(() => { const c = document.querySelector('canvas'); const o = { pointerId: 55, pointerType: 'touch', bubbles: true, clientX: ${'${x}'}, clientY: ${'${y}'} }; (${type === 'pointerdown' ? 'c' : 'window'}).dispatchEvent(new PointerEvent('${type}', o)); })()`.replace('${x}', x).replace('${y}', y));
await touch('pointerdown', stickAt.x, stickAt.y);
await touch('pointermove', stickAt.x, stickAt.y - 90);
const said = new Set();
let lowShot = false;
// headless runs slower than real time, so go by the game's own clock: up to 14 s of riding (a full tank is about 10 s
// of sprint on the dirt jumper), stopping once it has said it's burnt
const clock = () => ev('window.__lab.s.clock');
const c0 = await clock(), t0 = Date.now();
while ((await clock()) - c0 < 14 && Date.now() - t0 < 120000 && ![...said].some((t) => t.includes('Burnt! Ease off'))) {
  const c = await callout();
  if (c) said.add(c.split('\n')[0]);
  if (!lowShot && (await fuel()) < 0.3) { await shot('energy-low'); lowShot = true; }
  // keep the bike pointed down the street
  await ev(`(() => { const s = window.__lab.s; s.yaw = 0; s.pos.z = -2; })()`);
  await sleep(100);
}
check((await fuel()) <= 0.1 || (await ev('window.__lab.s.burnt')), `held sprint empties the ring (${await fuel()}, burnt ${await ev('window.__lab.s.burnt')})`);
check([...said].some((t) => t.includes('Burnt! Ease off')), `"Burnt! Ease off" was said (${JSON.stringify([...said])})`);
check([...said].some((t) => t.includes('Pushing hard uses energy')), `"Pushing hard uses energy" was said once`);
check(await ev(`document.querySelector('#lab .stick .fuel').classList.contains('burnt') === window.__lab.s.burnt`), 'the ring flashes while burnt');
await shot('energy-burnt');
await touch('pointerup', stickAt.x, stickAt.y - 90);
const c1 = await clock();
await until(`window.__lab.s.clock - ${'${c1}'} > 5`.replace('${c1}', c1), 60000);
check((await fuel()) >= 0.5, `letting go refills it (${await fuel()})`);
check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 3))})`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
chrome.kill();
process.exit(fails ? 1 : 0);
