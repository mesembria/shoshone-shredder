// The bikes, on /play.html: a rider who owns two bikes swaps between exactly those (and the swap is saved), one bike
// means no Swap, saved Tune values never reach a ride without ?tune=1, swapping at speed and mid-crash, and side-on
// shots of all four bikes (?bike= owns them all).
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
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) fails++; };
// an earlier session's Tune save: it must never reach a ride without ?tune=1
const fresh = (color) => ({ parts: [], fitted: {}, color });
const two = { name: 'Two Bikes', cogs: 0, riding: 'enduro', bikes: { hardtail: fresh(0x7d8a96), enduro: fresh(0x1f8a8a) }, stars: {}, paid: {} };
const one = { name: 'One Bike', cogs: 0, riding: 'hardtail', bikes: { hardtail: fresh(0x7d8a96) }, stars: {}, paid: {} };
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html' });
await sleep(1500);
await ev(`(() => { localStorage.clear(); localStorage.setItem('shredder-save', ${JSON.stringify(JSON.stringify({ version: 2, riders: [two, one] }))}); localStorage.setItem('shredder-lab-tune', '{"hopFull":9,"shake":0.15}'); localStorage.setItem('shredder-welcomed-2', '["Two Bikes","One Bike"]'); })()`);
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?rider=0&at=Street' });
await until(`!!window.__lab`, 15000); await sleep(1500);
// what each owned bike should ride like, from the game's own modules
const tuneOf = (bike) => ev(`import('/src/game/progress.ts').then((m) => m.loadoutOf(m.loadGame(localStorage).riders[0], '${bike}').tune)`);
const matches = (bike) => ev(`import('/src/game/progress.ts').then((m) => { const t = m.loadoutOf(m.loadGame(localStorage).riders[0], '${bike}').tune, T = window.__lab.T; return Object.keys(t).filter((k) => T[k] !== t[k]); })`);
const enduroTune = await tuneOf('enduro');
check(await ev(`window.__lab.bike() === 'enduro' && window.__lab.T.hopFull === ${enduroTune.hopFull} && window.__lab.T.shake === window.__lab.DEFAULTS.shake`), `no ?tune=1: the enduro's numbers, nothing from the saved Tune (hopFull ${await ev('window.__lab.T.hopFull')}, shake ${await ev('window.__lab.T.shake')})`);
check(await ev(`!document.querySelector('#lab .tune-toggle')`), 'no ?tune=1: no Tune button');

// the Swap button names the bike you're riding, not the next one (the boys read it as their bike)
const names = { hardtail: 'Hand-me-down Hardtail', dirtjumper: 'Orange Dirt Jumper', enduro: 'Teal Enduro', bolinas: 'Tan Bolinas Ridge' };
const labelOk = async () => { const [id, text] = await ev(`[window.__lab.bike(), document.querySelector('#lab .swap').textContent]`); return text.includes(names[id]) && !Object.values(names).some((n) => n !== names[id] && text.includes(n)); };
const swapShown = () => ev(`(() => { const b = document.querySelector('#lab .swap'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; })()`);
check(await swapShown(), 'two bikes owned: Swap shows');
let allLabels = await labelOk();
const seen = [];
for (let i = 0; i < 4; i++) { await ev(`window.__lab.swap()`); seen.push(await ev('window.__lab.bike()')); allLabels = allLabels && (await labelOk()); }
check(JSON.stringify(seen) === JSON.stringify(['hardtail', 'enduro', 'hardtail', 'enduro']), `Swap goes between exactly the two owned bikes (${JSON.stringify(seen)})`);
check(allLabels, `Swap button names the bike being ridden (${await ev(`document.querySelector('#lab .swap').textContent`)})`);

// swap while riding: same place, same speed, the hardtail's own numbers, nothing left from the enduro
await touch('touchStart', [[130, row, 2]]); await touch('touchMove', [[130, row - 70, 2]]);
await sleep(1500);
// read before and after in one go: at 10 m/s the bike rolls a metre between two separate calls
const { before, after } = await ev(`(() => { const L = window.__lab, read = () => ({ x: L.s.pos.x, z: L.s.pos.z, v: L.s.speed, n: L.look.scene.children.length });
  const before = read(); L.swap(); return { before, after: read() }; })()`);
await touch('touchEnd', []);
check(await ev(`window.__lab.bike() === 'hardtail'`), 'swap goes enduro → hardtail');
const stale = await matches('hardtail');
check(stale?.length === 0, `the hardtail's own numbers (its loadout), nothing left from the enduro (${JSON.stringify(stale)})`);
check(Math.hypot(after.x - before.x, after.z - before.z) < 0.5 && Math.abs(after.v - before.v) < 0.5, `same place and speed across the swap (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
check(after.n === before.n, `scene object count unchanged (${before.n} → ${after.n})`);
check(await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders[0].riding === 'hardtail'`), 'the swap is saved (riding: hardtail)');

// the Swap button with a real touch: the bike changes, and the stick and Jump never see the touch
await sleep(500);
const btn = await ev(`(() => { const r = document.querySelector('#lab .swap').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
await touch('touchStart', [[btn.x, btn.y, 5]]);
await sleep(120);
const thumbs = await ev(`(() => { const t = window.__lab.pad.thumbs(); return t.left === null && t.right === null; })()`);
await touch('touchEnd', []);
await sleep(300);
check(thumbs, 'the Swap tap never reaches the stick or Jump');
check(await ev(`window.__lab.bike() === 'enduro'`), `the Swap button changed the bike (now ${await ev('window.__lab.bike()')})`);
check(await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders[0].riding === 'enduro'`), 'and saved it (riding: enduro)');

// one bike owned: no Swap at all
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?rider=1&at=Street' });
await until(`!!window.__lab`, 15000); await sleep(800);
check(await ev(`window.__lab.bike() === 'hardtail'`) && !(await swapShown()), 'one bike owned: Swap hidden');
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))`); await sleep(100);
check(await ev(`window.__lab.bike() === 'hardtail'`), 'and the B key does nothing');

// ?tune=1: the drawer is there, saved Tune values load (a bike's own numbers still beat them), and Swap gets out of
// its way (it would cover the station buttons)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=enduro&at=Street&tune=1' });
await until(`!!window.__lab`, 15000); await sleep(1200);
check(await ev(`!!document.querySelector('#lab .tune-toggle') && window.__lab.T.shake === 0.15 && window.__lab.T.hopFull === ${enduroTune.hopFull}`), `?tune=1: Tune shows, saved values load, the enduro's own numbers win (shake ${await ev('window.__lab.T.shake')}, hopFull ${await ev('window.__lab.T.hopFull')})`);
await ev(`document.querySelector('#lab .tune-toggle').click()`);
await sleep(200);
check(!(await swapShown()), 'Swap button hidden while Tune is open');
await ev(`document.querySelector('#lab .tune [data-act=close]').click()`);
await sleep(200);
check(await swapShown(), 'Swap button back when Tune closes');

// swap mid-crash: the tumbling bike and rider must not stay behind in the scene (?bike= owns every bike, unsaved)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=dirtjumper&at=Street' });
await until(`!!window.__lab`, 15000); await sleep(1500);
const base = await ev(`window.__lab.look.scene.children.length`);
// on the dirt jumper: wipes out on rocks at 3 m/s
await ev(`window.__lab.teleport('Summit')`);
await sleep(800);
// Summit is Goat Ladder ↓'s ring now: its card pops up (and pauses the ride) until it's closed
if (await ev(`window.__game.modal() === 'card'`)) await ev(`document.querySelector('#lab .card .close').click()`);
await sleep(200);
await touch('touchStart', [[130, row, 2]]); await touch('touchMove', [[130, row - 70, 2]]);
const crashed = await until(`!!window.__lab.s.crash`, 20000);
await touch('touchEnd', []);
await sleep(300);
const mid = await ev(`window.__lab.look.scene.children.length`);
await ev(`window.__lab.swap()`);
await sleep(300);
const end = await ev(`window.__lab.look.scene.children.length`);
check(crashed, 'the dirt jumper crashed on the descent');
check(end === base, `scene back to ${base} objects after a mid-crash swap (mid-crash ${mid}, after ${end})`);

// side-on shots of all four bikes, standing still at Street
await ev(`window.__lab.teleport('Street')`);
await sleep(1500);
await ev(`(() => { const L = window.__lab, r = L.look.renderer, draw = r.render.bind(r);
  r.render = (scene, cam) => { const p = L.s.pos, y = L.s.yaw; cam.position.set(p.x + Math.sin(y) * 3, p.y + 1.0, p.z + Math.cos(y) * 3); cam.lookAt(p.x, p.y + 0.7, p.z); draw(scene, cam); }; })()`);
const shotBikes = new Set();
for (let i = 0; i < 4; i++) {
  await ev(`window.__lab.swap()`);
  await sleep(1200);
  const b = await ev('window.__lab.bike()');
  shotBikes.add(b);
  await shot(`bike-${b}`);
}
check(shotBikes.size === 4, `side-on shots of all four bikes (${[...shotBikes]})`);
check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
