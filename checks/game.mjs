// Drives the ride on /play.html end to end in headless Chromium, for a rider whose save owns the hardtail, the dirt
// jumper and the enduro: the welcome card, the menu (🗺 Map, 📍 Mesa Jump Park; no Tune), Cone Zone (a time, stars and
// cogs), the area list, a locked ring's card, a backflip tried on the enduro, swapping (owned bikes only) to the dirt
// jumper mid-challenge and landing one, a time star dropping off the strip, the downhill boost, finishing Hairpin Hollow ↑ beside the ↓ ring, the swap
// being saved, and the ?bike= quick start. Prints PASS/FAIL lines; exits non-zero on any FAIL.
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
const shown = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; })()`);
const callout = () => text('#hud .callout');
const inAir = `!window.__lab.s.grounded && window.__lab.s.air && window.__lab.s.air.t > 0.05`;
// off the medium tables: in the air long enough to swipe a trick
const launch = async () => { await ev(`(() => { const s = window.__lab.s, m = window.__lab.course.stations['Jumps M'].pos; s.pos.x = -31; s.pos.z = m.z; s.yaw = 0; s.speed = 9.5; })()`); return until(inAir); };

// ---- a rider who owns three bikes (a v2 save, written before the ride loads)
const fresh = (color) => ({ parts: [], fitted: {}, color });
const me0 = { name: 'Tester', cogs: 0, riding: 'enduro', bikes: { hardtail: fresh(0x7d8a96), dirtjumper: fresh(0xf26b1d), enduro: fresh(0x1f8a8a) }, stars: { tableSmall: 1 }, paid: { tableSmall: 1 } }; // 1 ★: Cone Zone open; after it at most 4, so Table Row Big (5) stays locked
const me1 = { name: 'Rider 2', cogs: 0, riding: 'hardtail', bikes: { hardtail: fresh(0x7d8a96) }, stars: {}, paid: {} };
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html' });
await sleep(1500);
await ev(`(() => { localStorage.clear(); localStorage.setItem('shredder-save', ${JSON.stringify(JSON.stringify({ version: 2, riders: [me0, me1] }))}); localStorage.setItem('shredder-lab-tune', '{"hopFull":9}'); localStorage.setItem('shredder-welcomed', '["Tester"]'); })()`); // the old build's welcomed list names this rider
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?rider=0&at=Park%20lot' });
check(await until(`!!window.__game && window.__lab?.course.place === 'mesaJumpPark'`, 15000), 'rider 0 starts riding on Mesa Jump Park');
await sleep(800);
const PAY = await ev(`import('/src/game/progress.ts').then((m) => m.PAY)`);
const payOf = (n) => PAY.tiers.slice(0, n).reduce((a, b) => a + b, 0); // first clears: every tier up to n
const loadoutHop = await ev(`import('/src/game/progress.ts').then((m) => m.loadoutOf(m.loadGame(localStorage).riders[0]).tune.hopFull)`);
check(await ev(`window.__lab.bike() === 'enduro' && window.__lab.T.hopFull === ${loadoutHop}`), `riding the enduro, with its numbers, not the saved Tune (${await ev('window.__lab.bike()')}, hopFull ${await ev('window.__lab.T.hopFull')} vs ${loadoutHop})`);
await shot('41-welcome');
const welcome = await text('#lab .card');
check(!!welcome && welcome.includes('Hi Tester') && welcome.includes('Ride into a glowing ring to try a challenge. Earn ⚙ cogs, then spend them in the Shop.') && welcome.includes('Fresh start!') && !/Tune|bolts|🔩/.test(welcome), `the welcome card, still shown to a rider on the old build's welcomed list, with the fresh-start line (${JSON.stringify(welcome)})`);
await click('#lab .card .close');
await sleep(1200);
await shot('42-riding');
const menu = await ev(`[...document.querySelectorAll('#lab .menu button')].map((b) => b.innerText.trim())`);
check(JSON.stringify(menu) === JSON.stringify(['🗺 Map', '📍 Mesa Jump Park']), `menu: 🗺 Map, 📍 Mesa Jump Park (${JSON.stringify(menu)})`);
check(await ev(`!document.querySelector('#lab .tune-toggle') && !document.querySelector('#lab .tune') && !document.querySelector('#lab .wallet')`), 'no Tune, no wallet');
check((await text('#lab .swap'))?.includes('Teal Enduro'), `Swap names the enduro (${JSON.stringify(await text('#lab .swap'))})`);
check(await shown('#lab .swap'), 'Swap shows while riding');
// the speed ring, top left, in place of the plain mph: lit segments and the number follow the bike's speed
// (read in an animation frame queued after the game's own, so the speed is the one the ring was just drawn from)
await ev(`(() => { window.__lab.s.speed = 9; })()`); await sleep(150);
const ring = await ev(`import('/src/lab/speed-ring.ts').then((m) => new Promise((ok) => requestAnimationFrame(() => { const s = window.__lab.s, T = window.__lab.T; ok({ lit: document.querySelectorAll('#lab .speed .seg.lit').length, want: m.ringSegments(s.speed, T).filter((x) => x.lit).length, num: +document.querySelector('#lab .speed .num').textContent, mph: m.mph(s.speed), old: !!document.querySelector('#lab .mph') }); })))`);
check(!!ring && Math.abs(ring.lit - ring.want) <= 1 && Math.abs(ring.num - ring.mph) <= 2 && !ring.old, `the speed ring lights with the speed, no plain mph (${JSON.stringify(ring)})`);
await shot('05-speed-ring');
check(await ev(`window.__lab.T.trickBoost === 0`), 'no downhill boost while just riding');
// a trick off any line scores nothing, and the ride keeps going (its chime once played note -1 and threw, stopping the loop)
{
  const before = { clock: await ev('window.__lab.s.clock'), errs: errs.length };
  await swipe(0, 140); // swipe down on the street: a manual on the flat
  await sleep(600);
  const after = await ev(`({ clock: window.__lab.s.clock, manual: window.__lab.s.manual, count: window.__lab.s.combo.count })`);
  check(after.clock > before.clock + 0.1 && errs.length === before.errs && after.count === 0, `a manual on the flat scores nothing and the ride keeps going (${JSON.stringify({ ...after, before, errs: errs.slice(before.errs) })})`);
}

// ---- Cone Zone (the slalom): a time, stars and cogs; Swap hidden while the cards are open
await ev(`(() => { const s = window.__lab.s, r = window.__lab.course.rings.Slalom; s.pos.set(r.x - 2.5, window.__lab.course.stations.Slalom.pos.y, r.z); s.speed = 3; })()`);
check(await until(`window.__game.modal() === 'card'`, 4000), `riding into the Cone Zone ring opens its card (${JSON.stringify(await text('#lab .card'))})`);
const coneCard = await text('#lab .card');
check(!!coneCard && coneCard.includes('Cone Zone') && !coneCard.includes('Slalom') && !!(await ev(`document.querySelector('#lab .card .ring[data-c="coneZone"] button.go')`)), `the card: Cone Zone with Go (${JSON.stringify(coneCard)})`);
check(!(await shown('#lab .swap')), 'Swap hidden while the spot card is open');
const coneMedals = await ev(`[...document.querySelectorAll('#lab .card .ring[data-c="coneZone"] .ui-medal .tgt')].map((t) => t.innerText)`);
check(JSON.stringify(coneMedals) === JSON.stringify(['under 30 s', 'under 14 s', 'under 12.5 s']) && !(await ev(`document.querySelector('#lab .card .ring[data-c="coneZone"] .chips')`)), `the card: what each star needs as medals, no trick chips (${JSON.stringify(coneMedals)})`);
await shot('43-spot-card');
await click('#lab .card .go');
await sleep(400);
check(await ev(`window.__game.modal() === 'countdown'`) && !(await shown('#lab .swap')), 'Swap hidden during the countdown');
check(await until(`!!window.__game.run()`, 5000), 'Cone Zone runs');
check(await ev(`window.__lab.T.trickBoost === 0`), 'no boost on a park run');
const coneGates = await ev('window.__lab.course.gates.map((g) => [(g.a.x + g.b.x) / 2, (g.a.y + g.b.y) / 2])');
for (let i = 0; i < coneGates.length; i++) {
  const [x, z] = coneGates[i];
  await ev(`(() => { const s = window.__lab.s; s.pos.set(${x - 0.6}, window.__lab.course.stations.Slalom.pos.y, ${z}); s.yaw = 0; s.speed = 6; })()`);
  await until(`(window.__game.run()?.count ?? 99) > ${i}`, 3000);
}
check(await until(`window.__game.modal() === 'card'`, 4000), 'Cone Zone finishes');
const result = await text('#lab .card');
// the stars won as big art (gold won, stone not), then the strip frozen where the run ended (the time)
const res = await ev(`({ sign: document.querySelector('#lab .card .ui-sign')?.innerText ?? '', won: document.querySelectorAll('#lab .card .bigstars .ui-star.won').length, big: document.querySelector('#lab .card .bigstars')?.innerText.replace(/\\s+/g, '') ?? '', have: document.querySelector('#lab .card .ui-strip .have')?.innerText ?? '' })`);
const won = res?.won ?? 0;
check(!!result && res.sign.includes('Cone Zone') && won >= 1 && res.big === '★'.repeat(won) + '☆'.repeat(3 - won) && /^\d+\.\d s$/.test(res.have) && result.includes(`+${payOf(won)} ⚙`) && !/bolts|🔩/.test(result), `result: the sign, ${won} ★ as art, the time on the strip, +${payOf(won)} ⚙ (${JSON.stringify({ res, result })})`);
check(await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders[0].cogs === ${payOf(won)}`), 'the cogs are saved');
const coneNext = await text('#lab .card .to-next');
check(won === 3 ? coneNext === null : !!coneNext && /^\d+\.\d s faster for ★★★?$/.test(coneNext.trim()), `result: ${won} ★ and how far from the next (${JSON.stringify(coneNext)})`);
check(!(await shown('#lab .swap')), 'Swap hidden while the result card is open');
await shot('46-result');
await click('#lab .card .close');
await sleep(200);
check(await shown('#lab .swap'), 'Swap back after the card closes');

// ---- a Park ring's card: what each star needs, what tricks are worth, and Go still on the card
await ev(`(() => { const s = window.__lab.s, r = window.__lab.course.rings['Jumps S']; s.pos.set(r.x - 2.5, window.__lab.course.stations['Jumps S'].pos.y, r.z); s.speed = 3; })()`);
check(await until(`window.__game.modal() === 'card'`, 4000), `riding into the Table Row Small ring opens its card (${JSON.stringify(await text('#lab .card'))})`);
const parkCard = await ev(`(() => { const ring = document.querySelector('#lab .card .ring[data-c="tableSmall"]'), card = document.querySelector('#lab .card').getBoundingClientRect(), go = ring?.querySelector('button.go')?.getBoundingClientRect(); return ring && { sign: ring.querySelector('.ui-sign')?.innerText, medals: [...ring.querySelectorAll('.ui-medal .tgt')].map((t) => t.innerText), chips: [...ring.querySelectorAll('.chip')].map((t) => t.innerText.replace(/\\s+/g, ' ').trim()), tip: ring.querySelector('.tip')?.innerText, goInside: !!go && go.bottom <= card.bottom && go.top >= card.top, cardFits: card.top >= 0 && card.bottom <= innerHeight }; })()`);
const want = await ev(`Promise.all([import('/src/game/targets.ts'), import('/src/game/challenges.ts'), import('/src/game/progress.ts')]).then(([t, c, p]) => ({ medals: t.starMedals(c.CHALLENGES.find((x) => x.id === 'tableSmall').goal, p.starPays(window.__game.me(), 'tableSmall')).map((m) => m.target), tip: t.COMBO_TIP }))`);
check(!!parkCard && parkCard.sign?.includes('Table Row Small') && JSON.stringify(parkCard.medals) === JSON.stringify(want.medals) && JSON.stringify(parkCard.chips) === JSON.stringify(['Backflip 400', '360 300', 'No-hander 200', 'Tabletop 150', 'Hop 50']) && parkCard.tip === want.tip && parkCard.goInside && parkCard.cardFits, `the Park card: sign, star medals, trick chips, combo tip, Go on the card (${JSON.stringify({ parkCard, want })})`);
await shot('47-park-card');
// ---- a wipeout on a Park challenge starts it again from the beginning (Trail and Downhill get up where they fell)
await click('#lab .card .ring[data-c="tableSmall"] button.go');
check(await until(`window.__game.run()?.def.id === 'tableSmall'`, 8000), 'Table Row Small runs');
await ev(`(() => { const s = window.__lab.s; s.pos.x += 6; s.speed = 6; })()`); await sleep(300);
await ev(`(() => { window.__lab.s.crash = { outcome: 'wipeout', t: 0 }; })()`);
check(await until(`!window.__game.run()`, 3000) && await ev(`window.__game.modal() !== 'card'`), 'the wipeout ends the run with no result card');
// (straight after, inside the 1.2 s before it counts down again: the run's HUD stays up, no menu, no Stop)
const between = await ev(`({ hud: getComputedStyle(document.querySelector('#lab .runhud')).display !== 'none', menu: getComputedStyle(document.querySelector('#lab .menu')).display !== 'none', stop: getComputedStyle(document.querySelector('#lab .b-stop')).display !== 'none', tag: getComputedStyle(document.querySelector('#lab .runhud .tag')).display !== 'none' })`);
check(!!between && between.hud && !between.menu && !between.stop, `between the wipeout and the restart: the sign stays, no menu, no Stop (${JSON.stringify(between)})`);
check(await until(`window.__game.modal() === 'countdown'`, 5000), 'then it counts down into Table Row Small again');
const back = await ev(`(() => { const s = window.__lab.s, st = window.__lab.course.stations['Jumps S'].pos; return [Math.hypot(s.pos.x - st.x, s.pos.z - st.z), !!s.crash]; })()`);
check(!!back && back[0] < 1.5 && !back[1], `back at the start, up and not crashed (${JSON.stringify(back)})`);
check(await until(`window.__game.run()?.def.id === 'tableSmall' && window.__game.run().t < 1`, 5000), 'and Table Row Small runs again from 0');
// during a run: Stop sits top right (where the menu was), and Map and 📍 are hidden
const stopAt = await ev(`(() => { const b = document.querySelector('#lab .b-stop'), r = b?.getBoundingClientRect(); return b && { shown: !b.hidden && r.width > 0, right: Math.round(r.right), top: Math.round(r.top), w: innerWidth, menu: !!document.querySelector('#lab .menu')?.offsetParent }; })()`);
check(!!stopAt && stopAt.shown && stopAt.right >= stopAt.w - 40 && stopAt.top < 320 && !stopAt.menu, `Stop top right, no Map or 📍 during the run (${JSON.stringify(stopAt)})`);
await click('#lab .b-stop'); await sleep(300);
check(await shown('#lab .menu') && !(await shown('#lab .runhud')) && !(await shown('#lab .b-stop')), 'after Stop: the menu is back, the sign and Stop are gone');
// a run that fails: the sign, the reason as the headline, how close it got, the buttons
await ev(`window.__game.start('tableSmall')`);
check(await until(`window.__game.run()?.def.id === 'tableSmall'`, 8000), 'Table Row Small runs once more');
await ev(`(() => { window.__game.run().t = 31; })()`);
check(await until(`window.__game.modal() === 'card'`, 4000), 'out of time ends it with a card');
const failed = await ev(`({ sign: document.querySelector('#lab .card .ui-sign')?.innerText ?? '', h2: document.querySelector('#lab .card h2')?.innerText, close: document.querySelector('#lab .card .how-close')?.innerText ?? '', buttons: [...document.querySelectorAll('#lab .card .buttons button')].length })`);
check(!!failed && failed.sign.includes('Table Row Small') && failed.h2 === 'Out of time' && /jumps cleared|trick points/.test(failed.close) && failed.buttons === 3, `the failed card: sign, "Out of time", how close, buttons (${JSON.stringify(failed)})`);
await shot('44-failed');
await click('#lab .card .close'); await sleep(200);

// ---- 📍 Mesa Jump Park: the area's grouped list (with stars and locks) and Just ride; Swap hidden
await click('#lab .menu .m-area'); await sleep(300);
await shot('50-area');
check(!(await shown('#lab .swap')), 'Swap hidden while the list is open');
const groups = await ev(`[...document.querySelectorAll('#lab .sheet .group h3')].map((h) => h.innerText.trim())`);
check(JSON.stringify(groups) === JSON.stringify(['Park']), `groups Park (Mesa Jump Park has no trails) (${JSON.stringify(groups)})`);
// (locked challenges that share a lock sit on one row: data-cs lists them all)
const rows = await ev(`[...document.querySelectorAll('#lab .sheet .row')].map((r) => ({ id: r.dataset.c, ids: (r.dataset.cs ?? r.dataset.c).split(' '), go: !!r.querySelector('button.go'), lock: r.querySelector('.lock')?.innerText ?? null, text: r.innerText.replace(/\\s+/g, '') }))`);
check(rows?.flatMap((r) => r.ids).length === 8 && rows.every((r) => r.go !== !!r.lock), `8 challenges, each with Go or a lock (${JSON.stringify(rows?.map((r) => [r.ids.join('+'), r.go, r.lock]))})`);
check(rows?.find((r) => r.id === 'coneZone')?.text.includes('★'.repeat(won)) && rows.find((r) => r.ids.includes('tableBig'))?.lock?.includes('🔒'), 'Cone Zone shows its stars; Table Row Big is locked');
const warps = await ev(`[...document.querySelectorAll('#lab .sheet button[data-at]')].map((b) => [b.dataset.at, b.innerText.trim()])`);
check(warps?.length === 10 && warps[0][1] === 'Park lot' && warps.some(([k, n]) => k === 'Jumps M' && n === 'Table Row Medium') && !/Jumps |Switchbacks|Rock chute|Street/.test(warps.map(([, n]) => n).join(' ')), `Just ride: display names (${JSON.stringify(warps)})`);
const sheetSmall = await ev(`[...document.querySelectorAll('#lab .sheet button')].filter((b) => b.offsetParent).map((b) => [b.innerText.trim().slice(0, 20), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]).filter(([, w, h]) => w < 44 || h < 44)`);
check(sheetSmall?.length === 0, `the list: nothing under 44 px (${JSON.stringify(sheetSmall)})`);

// ---- the enduro can try a backflip too (tricks run on physics): it starts, and off Jumps M it runs out of air
await click('#lab .sheet button[data-at="Jumps M"]'); await sleep(300);
check(await ev(`window.__game.modal() === null`), 'a Just ride warp closes the list');
check(await launch(), 'in the air off Table Row Medium on the enduro');
const below = await text('.jumpbtn .below');
check(below !== null && below.includes('Backflip') && below.includes('360'), `enduro air hints list the Backflip and 360 (${JSON.stringify(below)})`);
await swipe(0, 90);
check(await until(`window.__lab.s.move?.id === 'flip'`, 1500), `a backflip starts on the enduro (${JSON.stringify(await ev('window.__lab.s.move'))})`);
await shot('47-enduro-flip');
await until(`window.__lab.s.grounded`, 5000);

// ---- a locked ring: its card says what opens it instead of Go (Table Row Big needs 5 ★)
// (the engine's own teleport, not a warp: it clears the backflip's crash and doesn't mark the ring as just warped to)
await ev(`window.__lab.teleport('Jumps L')`);
check(await until(`window.__game.modal() === 'card'`, 4000), 'riding into the Table Row Big ring opens its card');
const bigCard = await text('#lab .card');
check(!!bigCard && bigCard.includes('Table Row Big') && bigCard.includes('🔒') && bigCard.includes('5 ★') && !(await ev(`!!document.querySelector('#lab .card button.go')`)), `locked: its lock text, no Go (${JSON.stringify(bigCard)})`);
await shot('52-locked');
await click('#lab .card .close'); await sleep(200);

// ---- swap mid-challenge: the run carries on, on the dirt jumper, and it backflips; Swap cycles owned bikes only
await ev(`window.__game.start('tableMedium')`);
check(await until(`!!window.__game.run()`, 5000), 'Table Row Medium runs');
const seen = [];
for (let i = 0; i < 3; i++) { await ev(`window.__lab.swap()`); seen.push(await ev('window.__lab.bike()')); }
check(JSON.stringify(seen) === JSON.stringify(['hardtail', 'dirtjumper', 'enduro']), `Swap cycles the three owned bikes, never the Bolinas (${JSON.stringify(seen)})`);
for (let i = 0; i < 3 && (await ev('window.__lab.bike()')) !== 'dirtjumper'; i++) await ev(`window.__lab.swap()`);
check(await ev(`window.__lab.bike() === 'dirtjumper' && !!window.__game.run()`), 'swapped to the dirt jumper, and the run carries on');
check((await text('#lab .swap'))?.includes('Orange Dirt Jumper'), 'Swap names the dirt jumper');
check(await launch(), 'in the air on the dirt jumper');
const djBelow = await text('.jumpbtn .below');
check(djBelow?.includes('Backflip'), `dirt jumper air hints offer the Backflip (${JSON.stringify(djBelow)})`);
await swipe(0, 90);
check(await until(`window.__lab.s.move?.id === 'flip'`, 1500), `a backflip starts (${JSON.stringify(await ev('window.__lab.s.move'))})`);
await shot('48-flip');
await until(`window.__lab.s.grounded || !!window.__lab.s.crash`, 6000);
check(await ev(`window.__lab.s.grounded && !window.__lab.s.crash && !!window.__game.run()`), `the backflip lands, and the run is still going (crash: ${JSON.stringify(await ev('!!window.__lab.s.crash'))})`);
await ev(`document.querySelector('#lab .b-stop')?.click()`);
await sleep(300);
if (await ev(`window.__game.modal() === 'card'`)) await click('#lab .card .close');

// ---- the other place: starting a Shredder Hills challenge from the jump park is a page load into the hill, straight into
// its countdown (?go=)
await ev(`window.__game.start('goatDown')`);
check(await until(`location.search.includes('go=goatDown')`, 5000), `Goat Ladder ↓ from the jump park goes to the hill (${await ev('location.search')})`);
check(await until(`!!window.__game && window.__lab?.course.place === 'shredderHills'`, 15000), 'and the ride is on Shredder Hills');
check(await until(`window.__game.modal() === 'countdown' || !!window.__game.run()`, 8000), 'straight into the Goat Ladder ↓ countdown');
check(await until(`window.__game.run()?.def.id === 'goatDown'`, 8000), 'Goat Ladder ↓ runs');

// ---- a time star lost: when ★★★'s fuse runs out, that one gold star falls away and fades where it stood, and the two
// still held stay put (the strip once slid the remaining stars down from above instead). The clock is pushed to just
// before ★★★'s time; the game's own tick runs it out.
const TIMES = await ev(`import('/src/game/challenges.ts').then((m) => m.CHALLENGES.find((c) => c.id === 'goatDown').goal.times)`);
const stripStars = `(() => { const n = document.querySelector('#lab .runhud .ui-strip .next'); if (!n) return null; const real = [...n.querySelectorAll('.ui-star:not(.lost)')], lost = [...n.querySelectorAll('.lost')];
  return { next: n.parentElement.dataset.next, real: real.length, gold: real.filter((x) => x.classList.contains('won')).length, lost: lost.length, over: lost.filter((x) => x.classList.contains('over')).length,
    lostAnim: lost.map((x) => getComputedStyle(x).animationName), heldAnim: [n, ...real].map((x) => getComputedStyle(x).animationName).filter((a) => a !== 'none') }; })()`;
await ev(`(() => { window.__game.run().t = ${TIMES[2] - 0.15}; })()`);
check(await until(`document.querySelector('#lab .runhud .ui-strip')?.dataset.next === '2'`, 3000), `the ★★★ fuse runs out (${JSON.stringify(await ev(stripStars))})`);
const dropping = await ev(stripStars);
await shot('48-star-drop');
check(!!dropping && dropping.real === 2 && dropping.gold === 2 && dropping.lost === 1 && dropping.over === 0 && dropping.lostAnim[0] === 'ui-drop' && dropping.heldAnim.length === 0,
  `one gold star falls away in its own place; the two held stay put (${JSON.stringify(dropping)})`);
await sleep(500);
const dropped = await ev(stripStars);
check(!!dropped && dropped.real === 2 && dropped.lost === 0, `then it's gone, and the strip goes on with ★★ (${JSON.stringify(dropped)})`);
// the last star going out leaves its empty one, and drops the gold one from on top of it (drawn off the ride: past the
// limit the run ends)
const last = await ev(`import('/src/game/pieces.ts').then((p) => { const d = document.createElement('div'); document.body.append(d);
  const s = { kind: 'time', next: 1, full: false, have: '39.9 s', fill: 0.01, open: 0, target: 'under 40', red: true, left: null };
  d.innerHTML = p.stripHtml(s); const el = d.firstElementChild; p.paintStrip(el, { ...s, fill: 0, have: '40.0 s' });
  const n = el.querySelector('.next'), g = n.querySelector('.lost.over'), e = n.querySelector('.ui-star:not(.lost)'), gr = g?.getBoundingClientRect(), er = e?.getBoundingClientRect();
  const r = { empty: !!e && !e.classList.contains('won'), over: !!g, same: !!gr && !!er && Math.abs(gr.left - er.left) < 1 && Math.abs(gr.top - er.top) < 1, real: n.querySelectorAll('.ui-star:not(.lost)').length };
  d.remove(); return r; })`);
check(!!last && last.empty && last.over && last.same && last.real === 1, `the last star: it drops from on top of the empty star it leaves (${JSON.stringify(last)})`);
await click('#lab .b-stop'); await sleep(300);

// ---- a crash on a Downhill run: do nothing and you get up where you fell, the clock still going; tap Again and it
// starts over from the start, the clock back at 0. The Again chip is quiet (dark glass, small), not a paper button
await ev(`window.__game.start('goatDown')`);
check(await until(`window.__game.run()?.def.id === 'goatDown'`, 8000), 'Goat Ladder ↓ runs again');
await sleep(1500);
await ev(`(() => { const s = window.__lab.s; s.pos.x += 3; window.__lab.s.crash = { outcome: 'wipeout', t: 0 }; })()`);
check(await until(`!window.__lab.s.crash`, 25000) && await ev(`window.__game.run()?.def.id === 'goatDown' && window.__game.run().t > 1.5`), 'left alone, the rider gets up and the run keeps its time');
await ev(`(() => { window.__lab.s.crash = { outcome: 'wipeout', t: 0 }; })()`);
check(await until(`getComputedStyle(document.querySelector('#hud .again')).opacity === '1'`, 3000), 'Again eases in after the crash');
const chip = await ev(`(() => { const b = document.querySelector('#hud .again'), c = getComputedStyle(b), r = b.getBoundingClientRect(); return { bg: c.backgroundColor, shadow: c.boxShadow, h: r.height, w: r.width }; })()`);
check(!!chip && chip.shadow === 'none' && /rgba\(31, 42, 51, 0\.4/.test(chip.bg) && chip.h < 40, `the Again chip is quiet (${JSON.stringify(chip)})`);
await shot('48-downhill-again');
await ev(`document.querySelector('#hud .again').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
check(await until(`window.__game.modal() === 'countdown'`, 2000), 'Again counts down into Goat Ladder ↓ again');
const top = await ev(`(() => { const s = window.__lab.s, st = window.__lab.course.stations['Summit'].pos; return [Math.hypot(s.pos.x - st.x, s.pos.z - st.z), !!s.crash]; })()`);
check(!!top && top[0] < 1.5 && !top[1], `back at the top, up and not crashed (${JSON.stringify(top)})`);
check(await until(`window.__game.run()?.def.id === 'goatDown' && window.__game.run().t < 1`, 5000), 'and Goat Ladder ↓ runs again from 0');
await click('#lab .b-stop'); await sleep(300);

// ---- the downhill boost: on while a Downhill run runs, off when it stops or on a warp
await ev(`window.__game.start('goatDown')`);
check(await until(`!!window.__game.run()`, 5000), 'Goat Ladder ↓ runs');
const BOOST = await ev(`import('/src/game/challenges.ts').then((m) => m.DOWNHILL_BOOST)`);
check(BOOST > 0 && await ev(`window.__lab.T.trickBoost === ${BOOST}`), `Goat Ladder ↓: trickBoost ${BOOST} (${await ev('window.__lab.T.trickBoost')})`);
await click('#lab .b-stop'); await sleep(200);
check(await ev(`window.__lab.T.trickBoost === 0 && !window.__game.run()`), 'Stop: the boost is off');
await ev(`window.__game.start('goatDown')`);
await until(`!!window.__game.run()`, 5000);
await click('#lab .menu .m-area'); await sleep(200);
await click('#lab .sheet button[data-at="Climb"]'); await sleep(300);
check(await ev(`window.__lab.T.trickBoost === 0 && !window.__game.run() && window.__game.modal() === null`), 'a warp mid-run: the run ends quietly, the boost is off');

// ---- finishing Hairpin Hollow ↑ ends 2 m from the ↓ ring: its card must not pop up
await ev(`window.__game.start('hairpinUp')`);
check(await until(`!!window.__game.run()`, 5000), 'Hairpin Hollow ↑ runs');
// the line's height: the start is at the bottom, the finish up at the top of the hill (the trail climbs ~10 m)
const across = (line, at) => ev(`(async () => { const g = window.__lab.course.runs.hairpinUp.${line}, s = window.__lab.s, y = window.__lab.course.stations['${at}'].pos.y;
  const mx = (g.a.x + g.b.x) / 2, mz = (g.a.y + g.b.y) / 2, nx = -(g.b.y - g.a.y), nz = g.b.x - g.a.x, n = Math.hypot(nx, nz);
  const put = (d) => { s.pos.set(mx + nx / n * d, y, mz + nz / n * d); s.yaw = Math.atan2(-nx, -nz); s.speed = 0; };
  put(-0.6); await new Promise((r) => setTimeout(r, 150)); put(0.4); await new Promise((r) => setTimeout(r, 150)); })()`);
await across('start', 'Switchbacks');
await across('finish', 'Switchbacks top');
check(await until(`window.__game.modal() === 'card'`, 3000), `Hairpin Hollow ↑ finishes (${JSON.stringify(await text('#lab .card'))})`);
check((await text('#lab .card'))?.includes('Hairpin Hollow ↑'), 'the result card is Hairpin Hollow ↑');
const ringD = await ev(`(() => { const s = window.__lab.s, st = window.__lab.course.stations['Switchbacks top'].pos; return Math.hypot(s.pos.x - st.x, s.pos.z - st.z); })()`);
const dy = await ev(`Math.abs(window.__lab.s.pos.y - window.__lab.course.stations['Switchbacks top'].pos.y)`);
check(dy < 1, `the bike is up at the top, on the trail (${dy?.toFixed(2)} m from the top station's height): the ring check below means something`);
await click('#lab .card .close');
await sleep(1200);
check(ringD < 5 && await ev(`window.__game.modal() === null`), `after the result, no Hairpin Hollow ↓ card (${ringD?.toFixed(1)} m from its ring; modal ${await ev('window.__game.modal()')}: ${JSON.stringify(await text('#lab .card'))})`);

// ---- back to the jump park by ?at= (a station in the other place), riding the Jump M lane
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?rider=0&at=Jumps%20M' });
check(await until(`!!window.__game && window.__lab?.course.place === 'mesaJumpPark'`, 15000), '?at=Jumps M rides on Mesa Jump Park');
await sleep(1200);
check(await ev(`window.__game.modal() === null`), `and lands riding, not on the spot card (modal ${await ev('window.__game.modal()')})`);

// ---- the swap was saved
const riding = await ev('window.__lab.bike()');
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?rider=0' }); await sleep(2500);
check(await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders[0].riding === ${JSON.stringify(riding)}`) && (await text('#hub .bar'))?.includes('Orange Dirt Jumper'), `reload: rider 0 is on the ${riding} (the swap was saved): ${JSON.stringify(await text('#hub .bar'))}`);

// ---- ?bike=
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=unicycle' }); await sleep(2500);
check(await ev(`!!document.querySelector('#who .rider')`), '?bike=unicycle: "Who\'s riding?" as normal');
const saveBefore = await ev(`localStorage.getItem('shredder-save')`);
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=enduro&at=Street' });
check(await until(`!!window.__lab && window.__lab.bike() === 'enduro'`, 15000), '?bike=enduro&at=Street: riding the enduro');
check(await ev(`window.__lab.course.place === 'shredderHills' && window.__lab.course.home === 'Trailhead'`), 'an old station key (Street) starts at the hill\'s trailhead');
check(await ev(`!document.getElementById('who') && window.__game.modal() === null`), 'no "Who\'s riding?" and no welcome card');
await ev(`window.__lab.swap()`); await sleep(200);
check(await ev(`localStorage.getItem('shredder-save')`) === saveBefore, '?bike=: a swap is not saved');
await send('Page.navigate', { url: 'http://127.0.0.1:5173/play.html?bike=enduro&at=Jumps%20M' });
await until(`!!window.__game`, 15000); await sleep(1200);
check(await ev(`window.__game.modal() === null`), `?at=Jumps M lands riding, not on the spot card (modal ${await ev('window.__game.modal()')})`);
await shot('51-quick');

// ---- the old lab page redirects here, keeping its query string
await send('Page.navigate', { url: 'http://127.0.0.1:5173/lab.html?bike=bolinas&at=Climb' });
check(await until(`location.pathname === '/play.html' && location.search === '?bike=bolinas&at=Climb'`, 8000), `/lab.html redirects to /play.html with its query (${await ev('location.href')})`);
check(await until(`!!window.__lab && window.__lab.bike() === 'bolinas'`, 15000), 'and rides the Bolinas from there');

check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
