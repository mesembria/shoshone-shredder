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
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } if (msg.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(msg.params.exceptionDetails.exception?.description)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, i]) => ({ x, y, id: i, radiusX: 12, radiusY: 12 })) });
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SP}/shots/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const until = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return true; await sleep(15); } return false; };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) fails++; };

// Side-on shots of every bike kit, rider hidden, from the left (rotors and calipers) and the right, at rest and right
// after a hard landing (slow motion, so the shot catches the squish). Also the draw calls the bike adds. Needs the dev
// server: npm run dev (http://127.0.0.1:5173).
// Usage: node checks/suspension-shots.mjs [dir]
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=enduro&at=Street&tune=1&slow=0.03' });
check(await until('!!window.__lab && !!window.__game', 20000), 'the ride loaded');
await ev(`window.__lab.teleport('Street')`);
await ev(`(() => { window.__lab.s.speed = 0; window.__game.ride.setPaused(true);
  const st = document.createElement('style'); st.textContent = 'body > :not(#game) { display: none !important }'; document.head.append(st); })()`);
await sleep(800);
// a fixed camera beside the bike: side = 1 is its right, -1 its left
await ev(`(() => { const L = window.__lab, r = L.look.renderer, draw = r.render.bind(r);
  window.__side = -1;
  r.render = (scene, cam) => { const p = L.s.pos, y = L.s.yaw, k = window.__side; cam.fov = 30; cam.updateProjectionMatrix(); cam.position.set(p.x - Math.sin(y) * 3.6 * k, p.y + 0.6, p.z - Math.cos(y) * 3.6 * k); cam.lookAt(p.x, p.y + 0.45, p.z); draw(scene, cam); }; })()`);
const builds = [
  ['hardtail', {}], ['hardtail-upgraded', { suspension: 'hardtail-air-fork', brakes: 'hardtail-hydraulic-brakes' }, 'hardtail'],
  ['dirtjumper', {}], ['bolinas', {}], ['enduro', {}], ['enduro-coil', { suspension: 'enduro-coil-shock' }, 'enduro'],
];
const designs = ['singlePivot', 'linkage', 'shortLink'];
async function show(spec) {
  await ev(`(async () => { const { loadout } = await import('/src/game/catalog.ts'); const { withKit, kitOf } = await import('/src/rules/bikes.ts');
    const s = ${spec}; window.__game.ride.setBike(s);
    const t = window.__lab.look.scene.getObjectByName('thigh0'); if (t) t.parent.visible = false; })()`);
  await sleep(500);
}
// drop the bike onto the flat: impact about 9 m/s (a rigid bike bottoms out; the Enduro uses most of its travel)
async function slam() {
  await ev(`(() => { const s = window.__lab.s; s.speed = 0; s.pitch = 0; s.pos.y += 1.6; s.grounded = false; s.vy = -5.5; window.__game.ride.setPaused(false); })()`);
  await sleep(300);
  const landed = await until('window.__lab.s.grounded', 90000);
  if (!landed) console.log('  bike at', await ev('JSON.stringify({ y: window.__lab.s.pos.y, g: window.__lab.s.groundY, vy: window.__lab.s.vy, grounded: window.__lab.s.grounded, paused: window.__game.ride.paused() })'));
  await sleep(2500); // about 0.08 s of ride time at slow=0.03: near the deepest point
  return landed;
}
const sideOf = (side) => (side < 0 ? 'left' : 'right');
for (const [name, fit, bike] of builds) {
  await show(`loadout('${bike ?? name}', ${JSON.stringify(fit)}).spec`);
  for (const side of [-1, 1]) { await ev(`window.__side = ${side}`); await sleep(250); await shot(`${name}-${sideOf(side)}`); }
  await ev(`window.__side = 1`);
  check(await slam(), `${name} landed`);
  await shot(`${name}-landing`);
  await ev(`(() => { window.__game.ride.setPaused(true); window.__lab.s.speed = 0; })()`);
  await ev(`window.__lab.teleport('Street')`);
}
// draw calls the bike adds (its shadow pass doubles them): the same frame with the bike shown and hidden
await show(`loadout('enduro', { suspension: 'enduro-coil-shock' }).spec`);
const calls = async () => { await sleep(400); return ev('window.__lab.look.renderer.info.render.calls'); };
const shown = await calls();
await ev(`(() => { const t = window.__lab.look.scene.getObjectByName('wheelFront'); let o = t; while (o.parent && o.parent.type !== 'Scene') o = o.parent; o.visible = false; window.__hid = o; })()`);
const hidden = await calls();
await ev('window.__hid.visible = true');
check(shown - hidden <= 2 * 23, `the Enduro (coil) adds ${shown - hidden} draw calls, at most 46 (23 meshes and their shadows)`);
for (const d of designs) {
  await show(`(() => { const sp = loadout('enduro', {}).spec; return { ...sp, kit: withKit(kitOf(sp), { rear: { design: '${d}' } }) }; })()`);
  await ev(`window.__side = 1`); await sleep(250); await shot(`rear-${d}`);
}
check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
