// Drives the hub on /play.html in headless Chromium, from a fresh save: Who's riding? (names, Ride!, no bikes) → the
// map (Shredder Hills, Garage, Shop, cogs) → the Shredder Hills sheet (three open rows, the rest locked) → Go lands in
// the ride's countdown; finishing Table Row Small pays the 1-star tier and 🗺 Map shows it; leaving mid-run pays and saves
// nothing; a Just ride warp lands riding there; the Garage (stand, dots, part card, Buy, Put it on, Paint, Specs,
// Ride this one); ?rider out of range shows Who's riding; ?bike= never touches the save.
// Prints PASS/FAIL lines; exits non-zero on any FAIL. node checks/hub.mjs [outdir] (screenshots go in outdir/shots).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const SP = process.argv[2] ?? mkdtempSync(`${tmpdir()}/shredder-hub-`);
mkdirSync(`${SP}/shots`, { recursive: true });
console.log('screenshots:', `${SP}/shots`);
const BIN = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const PORT = 9341;
// a fresh profile dir each run: an empty localStorage, so both riders start fresh
const chrome = spawn(BIN, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(`${SP}/profile-`)}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await sleep(250); } }
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
const shown = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); return !!b && !b.hidden && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0; })()`);
// every visible button under root that is smaller than 44 px either way
// a real tap at a screen point, through the browser's touch input (not element.click())
const tapAt = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const centre = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; })()`);
const small = (root) => ev(`(() => { const bs = [...document.querySelectorAll(${JSON.stringify(root + ' button')})].filter((b) => b.offsetParent); return bs.length ? bs.map((b) => [b.innerText.trim().slice(0, 20), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]).filter(([, w, h]) => w < 44 || h < 44) : null; })()`); // null: no buttons at all
// ride a jump lane: straight along it at 8 m/s until the run ends, scoring `trick` points each air (Table Row Small:
// three clean tables, just over its 1-star points in all, 1 ★); with stopAt, until that many jumps are cleared, leaving
// the run going
// (Table Row Small's lane on Mesa Jump Park is z 10)
const driveLane = async (z, stopAt = 99, trick = Math.ceil(N.small[0] / 2)) => { const t0 = Date.now(); while (Date.now() - t0 < 40000) {
  const r = await ev(`(() => { const s = window.__lab.s, run = window.__game.run(); if (!run || run.count >= ${stopAt}) return true; s.yaw = 0; if (s.grounded) { s.pos.z = ${z}; if (s.speed < 8) s.speed = 8; s.__scored = false; } else if (s.air && !s.__scored) { s.combo = { points: s.combo.points + ${trick}, count: s.combo.count + 1 }; s.__scored = true; } return false; })()`);
  if (r) return true; await sleep(60); } console.log('  lane state', await ev(`JSON.stringify({ run: window.__game.run() && { t: window.__game.run().t, count: window.__game.run().count, points: window.__game.run().points }, x: window.__lab.s.pos.x, v: window.__lab.s.speed, N: ${JSON.stringify(N?.small)} })`)); return false; };
const go = async (q) => { await send('Page.navigate', { url: `http://127.0.0.1:5173/play.html${q}` }); await sleep(300); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
let fails = 0, N = null;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) fails++; };

// ---- Who's riding? from a fresh save
await go('');
await ev(`localStorage.clear()`);
await go('');
// what the game pays and charges, read from its own modules (so retuning the numbers never breaks this check)
N = await ev(`Promise.all([import('/src/game/progress.ts'), import('/src/game/catalog.ts'), import('/src/game/challenges.ts')]).then(([p, c, ch]) => ({ tiers: p.PAY.tiers, part: Object.fromEntries(c.PARTS.map((x) => [x.id, x.price])), bike: Object.fromEntries(Object.entries(c.SHEETS).map(([k, v]) => [k, v.price])), small: ch.CHALLENGES.find((x) => x.id === 'tableSmall').goal.points }))`);
const [T1, T2, T3] = N.tiers, STICKY = N.part['hardtail-sticky-tires'], BRAKES = N.part['hardtail-hydraulic-brakes'], DJ = N.bike.dirtjumper;
const BIG = N.part['dirtjumper-big-gear'], FAST = N.part['dirtjumper-fast-tires'];
check(await until(`document.querySelectorAll('#who .rider').length === 2`, 8000), "fresh save: Who's riding? shows two riders");
await shot('80-who');
const whoText = await text('#who');
check(!!whoText && whoText.includes('Rider 1') && whoText.includes('Rider 2'), `both names shown (${JSON.stringify(whoText)})`);
check(await ev(`document.querySelectorAll('#who button[data-bike]').length === 0`), 'no bike buttons');
check(await ev(`document.querySelectorAll('#who .rider .go').length === 2 && document.querySelectorAll('#who .rider .rename').length === 2`), 'each rider has Ride! and rename');
check(!/★|🔩|bolts/.test(whoText ?? ''), 'no stars or bolts');
const whoSmall = await small('#who');
check(whoSmall?.length === 0, `Who's riding: nothing under 44 px (${JSON.stringify(whoSmall)})`);

// ---- Ride! → that rider's map
await click('#who .rider[data-i="0"] .go');
check(await until(`location.search === '?rider=0' && !!document.querySelector('#hub .pin')`, 8000), `Ride! → ?rider=0 shows the map (${await ev('location.href')})`);
await sleep(600);
await shot('81-map');
const pins = await ev(`[...document.querySelectorAll('#hub .pin')].map((p) => p.dataset.place)`);
check(JSON.stringify(pins?.slice().sort()) === JSON.stringify(['garage', 'mesaJumpPark', 'shop', 'shredderHills']), `pins: Shredder Hills, Mesa Jump Park, Garage, Shop (${JSON.stringify(pins)})`);
const hills = await text('#hub .pin[data-place="shredderHills"]');
check(!!hills && hills.includes('Shredder Hills') && hills.includes('●'), `Shredder Hills pin with its ● (${JSON.stringify(hills)})`);
check((await text('#hub .pin[data-place="garage"]'))?.includes('Garage'), 'Garage pin');
check((await text('#hub .pin[data-place="shop"]'))?.includes('Shop'), 'Shop pin');
check(await ev(`document.body.classList.contains('styled') && getComputedStyle(document.querySelector('#hub')).visibility === 'visible'`), 'the page shows once styled');
const bar = await text('#hub .bar');
check(!!bar && bar.includes('Rider 1') && bar.includes('Hand-me-down Hardtail') && bar.includes('0 ⚙') && bar.includes('Switch rider'), `top bar: rider · bike, 0 ⚙, Switch rider (${JSON.stringify(bar)})`);
check(await ev(`(() => { const r = document.querySelector('#hub .pin[data-place="shredderHills"]').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`), 'the Shredder Hills pin sits on screen');
check(await ev(`(() => { const r = document.querySelector('#hub .pin[data-place="mesaJumpPark"]').getBoundingClientRect(); const h = document.querySelector('#hub .pin[data-place="shredderHills"]').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && (r.right < h.left || r.left > h.right || r.bottom < h.top || r.top > h.bottom); })()`), 'the Mesa Jump Park pin sits on screen, clear of Shredder Hills');
// the picture once public/map/colorado.png is served, else the drawn stand-in
check(await until(`!document.querySelector('#hub .art').hidden || getComputedStyle(document.querySelector('#hub .map svg')).display !== 'none'`, 4000), 'the map shows the picture or the drawn stand-in');
const mapSmall = await small('#hub');
check(mapSmall?.length === 0, `map: nothing under 44 px (${JSON.stringify(mapSmall)})`);
check(!/🔩|bolts/.test(await text('#hub') ?? ''), 'no bolts on the map');

// ---- the Shredder Hills sheet
await click('#hub .pin[data-place="shredderHills"]');
check(await until(`!!document.querySelector('#hub .sheet:not([hidden]) .row')`, 3000), 'tapping Shredder Hills opens its sheet');
await sleep(300);
await shot('82-sheet');
const groups = await ev(`[...document.querySelectorAll('#hub .sheet h3')].map((h) => h.innerText.trim())`);
check(JSON.stringify(groups?.slice(0, 2)) === JSON.stringify(['Trail', 'Downhill']) && groups?.[2] === 'Just ride', `groups Trail, Downhill, then Just ride (${JSON.stringify(groups)})`);
const rows = await ev(`[...document.querySelectorAll('#hub .sheet .row')].map((r) => ({ name: r.querySelector('b').innerText, go: !!r.querySelector('button.go'), lock: r.querySelector('.lock')?.innerText ?? null, text: r.innerText, meta: r.querySelector('.meta')?.innerText ?? null }))`);
const open = rows?.filter((r) => r.go).map((r) => r.name) ?? [];
check(JSON.stringify(open.slice().sort()) === JSON.stringify(['Goat Ladder ↑', 'Goat Ladder ↓'].sort()), `exactly two rows with Go (${JSON.stringify(open)})`);
const locked = rows?.filter((r) => !r.go) ?? [];
check(rows?.length === 7 && locked.length === 5 && locked.every((r) => r.lock && r.lock.length > 3 && r.meta === null), `the other 5 show only their name and lock text (${JSON.stringify(locked.map((r) => [r.name, r.lock, r.meta]))})`);
// gold stars won, then each empty star with its price and the cog under it
const starRow = (t, won, left) => t.replace(/\s+/g, '').includes('★'.repeat(won) + left.map((c) => `☆${c}⚙`).join(''));
const openRows = rows?.filter((r) => r.go) ?? [];
check(openRows.length === 2 && openRows.every((r) => starRow(r.meta, 0, [T1, T2, T3]) && !/★/.test(r.meta)), `every open row: each empty star shows its price, ☆${T1}⚙ ☆${T2}⚙ ☆${T3}⚙ (${JSON.stringify(openRows[0]?.text)})`);
const head = await ev(`({ sign: document.querySelector('#hub .sheet .sheet-head .ui-sign')?.innerText ?? '', star: !!document.querySelector('#hub .sheet .area-stars .ui-star.won') })`);
check(head?.sign.includes('Shredder Hills') && head.star, `the sheet head: the area on the sign, the gold star art on the count (${JSON.stringify(head)})`);
const warps = await ev(`[...document.querySelectorAll('#hub .sheet button[data-at]')].map((b) => [b.dataset.at, b.innerText.trim()])`);
check(warps?.length === 8 && warps[0][0] === 'Trailhead' && warps[0][1] === 'Trailhead' && warps.some(([k, n]) => k === 'Rock chute' && n === 'Boulder Dash') && !warps.some(([k]) => k === 'Jumps M'), `Just ride (hills): Trailhead first, display names, only this place (${JSON.stringify(warps)})`);
check(warps?.length > 0 && !/Jumps |Switchbacks|Rock chute|Street|Start$/.test(warps.map(([, n]) => n).join(' ')), 'warps show no station keys');
const sheetSmall = await small('#hub .sheet');
check(sheetSmall?.length === 0, `sheet: nothing under 44 px (${JSON.stringify(sheetSmall)})`);
await ev(`document.querySelector('#hub .sheet').scrollTop = 1e6`); await sleep(200);
await shot('83-sheet-bottom');
await click('#hub .sheet .close');
check(await until(`!!document.querySelector('#hub .sheet[hidden]')`, 2000), 'the sheet closes');

// ---- the Mesa Jump Park sheet
await click('#hub .pin[data-place="mesaJumpPark"]');
check(await until(`!!document.querySelector('#hub .sheet:not([hidden]) .row')`, 3000), 'tapping Mesa Jump Park opens its sheet');
await sleep(300);
await shot('82b-park-sheet');
const parkHead = await text('#hub .sheet .sheet-head');
check(!!parkHead && parkHead.includes('Mesa Jump Park') && parkHead.includes('★ 0 of 24'), `park sheet head (${JSON.stringify(parkHead)})`);
const parkRows = await ev(`[...document.querySelectorAll('#hub .sheet .row')].map((r) => ({ name: r.querySelector('b').innerText, go: !!r.querySelector('button.go'), lock: r.querySelector('.lock')?.innerText ?? null }))`);
check(parkRows?.length === 5 && parkRows.filter((r) => r.go).map((r) => r.name).join() === 'Table Row Small' && parkRows.filter((r) => !r.go).every((r) => r.lock), `park: 5 rows (shared locks on one row), only Table Row Small open (${JSON.stringify(parkRows)})`);
const medium = parkRows?.find((r) => r.name.startsWith('Table Row Medium')), big = parkRows?.find((r) => r.name === 'Table Row Big · XL');
check(medium?.name === 'Table Row Medium · The Pump House · The Plank' && medium.lock === '🔒 Ride 2 ★' && big?.lock === '🔒 Ride 5 ★', `park locks read "Ride n ★" (total stars), shared ones on one row (${JSON.stringify([medium, big])})`);
const parkWarps = await ev(`[...document.querySelectorAll('#hub .sheet button[data-at]')].map((b) => [b.dataset.at, b.innerText.trim()])`);
check(parkWarps?.length === 10 && parkWarps[0][0] === 'Park lot' && parkWarps.some(([k, n]) => k === 'Jumps M' && n === 'Table Row Medium') && !parkWarps.some(([k]) => k === 'Climb'), `Just ride (park): Park lot first, only this place (${JSON.stringify(parkWarps)})`);
const parkSmall = await small('#hub .sheet');
check(parkSmall?.length === 0, `park sheet: nothing under 44 px (${JSON.stringify(parkSmall)})`);
await click('#hub .sheet .close');
check(await until(`!!document.querySelector('#hub .sheet[hidden]')`, 2000), 'the park sheet closes');

// ---- Go on Table Row Small → the ride, counting down into it
await click('#hub .pin[data-place="mesaJumpPark"]');
await sleep(200);
await click('#hub .sheet .row[data-c="tableSmall"] button.go');
check(await until(`location.search === '?rider=0&go=tableSmall'`, 5000), `Go → ?rider=0&go=tableSmall (${await ev('location.search')})`);
check(await until(`!!window.__game && window.__game.modal() === 'countdown'`, 20000), 'the ride loads into the countdown');
// a combo ridden into the ring, planted while the countdown is still up (checked in the same step)
const planted = await ev(`(() => { if (window.__game.modal() !== 'countdown') return false; window.__lab.s.combo = { points: 500, count: 3 }; return true; })()`);
// read before the screenshot: under swiftshader a screenshot can outlast the 2.6 s countdown. Under the 3-2-1, the
// three star medals; up top, the sign and the strip at rest; no Map or 📍 (a tap there would drop the run)
const counting = await ev(`(() => { const m = document.querySelector('#lab .count-medals'); return { shown: !!m && !m.hidden, medals: m ? m.querySelectorAll('.ui-medal').length : 0, text: m?.innerText ?? '', sign: document.querySelector('#lab .runhud .ui-sign')?.innerText ?? '', next: document.querySelector('#lab .runhud .ui-strip')?.dataset.next, menu: !!document.querySelector('#lab .menu')?.offsetParent, tag: getComputedStyle(document.querySelector('#lab .runhud .tag')).display !== 'none' }; })()`);
await shot('84-countdown');
const pts = N.small.map((n) => `${n.toLocaleString('en-US')} points`);
check(!!counting && counting.shown && counting.medals === 3 && pts.every((p) => counting.text.includes(p)) && counting.sign.includes('Table Row Small') && counting.next === '1' && !counting.menu && !counting.tag, `the countdown: the sign, the strip at rest (no goal tag yet), three medals with what each star needs, no menu (${JSON.stringify(counting)})`);
check(await until(`window.__game.run()?.def.id === 'tableSmall'`, 5000), 'Table Row Small runs after the countdown');
check(planted && await ev(`window.__game.run().points === 0 && window.__lab.s.combo.count === 0`), `a combo ridden in doesn't count (planted in the countdown ${planted}, points ${await ev('window.__game.run().points')})`);
check(!(await shown('#lab .count-medals')), 'the medals go at GO');
// (headless software rendering is slow, so wait for the strip's own text rather than a fixed time)
const firstStar = N.small[0].toLocaleString('en-US');
check(await until(`document.querySelector('#lab .runhud .tag-t')?.textContent === 'Jumps' && document.querySelector('#lab .runhud .ui-strip .target')?.textContent === ${JSON.stringify(firstStar)}`, 8000), 'the tag and the strip show the goal and the next star within 8 s');
const during = await ev(`({ tag: document.querySelector('#lab .runhud .tag')?.innerText, strip: document.querySelector('#lab .runhud .ui-strip')?.innerText, score: !!document.querySelector('#hud .score')?.offsetParent })`);
check(!!during && /^Jumps/.test(during.tag) && during.strip?.includes(firstStar) && !during.score, `during the run: "Jumps" and pips, the next star ★ ${firstStar}, no free-ride score (${JSON.stringify(during)})`);
await shot('85-run');
// the longest name's sign fits between the speed ring and the right-hand buttons
const fits = await ev(`import('/src/game/pieces.ts').then((p) => { document.querySelector('#lab .runhud .ui-sign .t').innerHTML = '● ' + p.nameHtml('Hairpin Hollow ↕'); const g = document.querySelector('#lab .runhud .ui-sign').getBoundingClientRect(), sp = document.querySelector('#lab .speed').getBoundingClientRect(); return { left: Math.round(g.left), right: Math.round(g.right), ring: Math.round(sp.right), w: innerWidth }; })`);
check(!!fits && fits.left >= fits.ring + 8 && fits.right <= fits.w - (fits.ring + 8), `the longest sign fits (${JSON.stringify(fits)})`);
check(await ev(`window.__lab.bike() === 'hardtail'`), 'on the hardtail');

// ---- no Tune in the ride; the menu is 🗺 Map and 📍 Mesa Jump Park
check(await ev(`!document.querySelector('#lab .tune-toggle') && !document.querySelector('#lab .tune')`), 'no Tune in the ride');
const menu = await ev(`[...document.querySelectorAll('#lab .menu button')].map((b) => b.innerText.trim())`);
check(JSON.stringify(menu) === JSON.stringify(['🗺 Map', '📍 Mesa Jump Park']), `menu: 🗺 Map, 📍 Mesa Jump Park (${JSON.stringify(menu)})`);

// ---- finish Table Row Small: stars, the 1-star pay, saved
check(await driveLane(10), 'Table Row Small: rode the three tables');
check(await until(`window.__game.modal() === 'card'`, 4000), 'the result card shows');
await shot('86-result');
const result = await text('#lab .card');
const res = await ev(`({ sign: document.querySelector('#lab .card .ui-sign')?.innerText ?? '', big: document.querySelector('#lab .card .bigstars')?.innerText.replace(/\\s+/g, '') ?? '', have: document.querySelector('#lab .card .ui-strip .have')?.innerText ?? '' })`);
check(!!result && res.sign.includes('Table Row Small') && res.big === '★☆☆' && /^\d{1,3}(,\d{3})*$/.test(res.have) && result.includes(`+${T1} ⚙`), `result: the sign, ★☆☆ as art, the points on the strip, +${T1} ⚙ (${JSON.stringify({ res, result })})`);
const toNext = await text('#lab .card .to-next'), opened = await text('#lab .card .opened');
check(!!toNext && /^\d{1,3}(,\d{3})* more points? for ★★$/.test(toNext.trim()), `result: how far from ★★ (${JSON.stringify(toNext)})`);
check(opened?.trim() === '🔓 Cone Zone is open!', `result: the first star opens Cone Zone (${JSON.stringify(opened)})`);
const saved = await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders[0]`);
check(saved?.cogs === T1 && saved?.stars?.tableSmall === 1, `saved right after paying: ${T1} cogs, 1 ★ (${JSON.stringify(saved && { cogs: saved.cogs, stars: saved.stars })})`);
// the result card goes back to the area's list (no page load), which already shows the new star
const cardButtons = await ev(`[...document.querySelectorAll('#lab .card .buttons button')].map((b) => b.innerText.trim())`);
check(JSON.stringify(cardButtons) === JSON.stringify(['Again', '📍 Mesa Jump Park', 'Ride on']), `result card: Again, 📍 Mesa Jump Park, Ride on (${JSON.stringify(cardButtons)})`);
await click('#lab .card .m-area'); await sleep(200);
const listRow = await text('#lab .sheet .row[data-c="tableSmall"]');
check(await ev(`window.__game.modal() === 'sheet'`) && !!listRow && starRow(listRow, 1, [T2, T3]), `📍 opens the list in the ride, Table Row Small ★ ☆${T2} ☆${T3} (${JSON.stringify(listRow)})`);
await click('#lab .sheet .close'); await sleep(200);

// ---- 🗺 Map → this rider's map, showing the cogs
await click('#lab .menu .m-map');
check(await until(`location.search === '?rider=0' && !!document.querySelector('#hub .bar')`, 8000), `🗺 Map → ?rider=0 (${await ev('location.href')})`);
check((await text('#hub .bar'))?.includes(`${T1} ⚙`), `the map shows ${T1} ⚙ (${JSON.stringify(await text('#hub .bar'))})`);
await click('#hub .pin[data-place="mesaJumpPark"]'); await sleep(200);
const smallRow = await text('#hub .sheet .row[data-c="tableSmall"]');
check(!!smallRow && starRow(smallRow, 1, [T2, T3]), `Table Row Small row: ★ ☆${T2} ☆${T3} ⚙ (${JSON.stringify(smallRow)})`);

// ---- leaving for the map mid-run pays nothing and saves nothing (Review Focus 5)
const beforeRun = await ev(`localStorage.getItem('shredder-save')`);
await click('#hub .sheet .row[data-c="tableSmall"] button.go');
await until(`window.__game?.modal() === 'countdown'`, 20000);
// the 3-2-1 medals: the won star reads "✓ won" as plain text, the others keep their yellow price pill
const medalPills = await ev(`[...document.querySelectorAll('#lab .count-medals .ui-medal')].map((m) => [m.classList.contains('won'), m.querySelector('.ui-pay').innerText.trim(), getComputedStyle(m.querySelector('.ui-pay')).backgroundColor])`);
await shot('87-medals');
check(medalPills.length === 3 && medalPills[0][0] && medalPills[0][1] === '✓ won' && medalPills[0][2] === 'rgba(0, 0, 0, 0)' && medalPills.slice(1).every(([w, t, bg]) => !w && /^\+\d+/.test(t) && bg === 'rgb(255, 241, 168)'), `medals: ★ "✓ won" has no pill, the unwon keep theirs (${JSON.stringify(medalPills)})`);
check(await until(`!!window.__game && window.__game.run()?.def.id === 'tableSmall'`, 20000), 'Table Row Small again');
check(await driveLane(10, 1) && await ev(`window.__game.run()?.count === 1`), 'one table cleared, the run still going');
await click('#lab .menu .m-map');
check(await until(`location.search === '?rider=0' && !!document.querySelector('#hub .bar')`, 8000), `🗺 Map mid-run → ?rider=0 (${await ev('location.href')})`);
check((await text('#hub .bar'))?.includes(`${T1} ⚙`), `cogs unchanged after leaving mid-run (${JSON.stringify(await text('#hub .bar'))})`);
check(await ev(`localStorage.getItem('shredder-save')`) === beforeRun, 'the save is as it was before the run');

// ---- a Just ride warp from the second rider's map
await go('?rider=1');
check(await until(`!!document.querySelector('#hub .pin')`, 8000) && (await text('#hub .bar'))?.includes('Rider 2'), `?rider=1: Rider 2's map (${JSON.stringify(await text('#hub .bar'))})`);
await click('#hub .pin[data-place="mesaJumpPark"]'); await sleep(200);
await click('#hub .sheet button[data-at="Jumps M"]');
check(await until(`location.search === '?rider=1&at=Jumps+M' || location.search === '?rider=1&at=Jumps%20M'`, 5000), `warp → ?rider=1&at=Jumps M (${await ev('location.search')})`);
check(await until(`!!window.__game`, 20000), 'the ride loads');
await sleep(800);
check(await ev(`window.__game.modal() !== 'countdown' && !window.__game.run() && window.__game.me().name === 'Rider 2'`), 'riding as Rider 2, no challenge');
const welcome = await text('#lab .card');
check(!!welcome && welcome.includes('Hi Rider 2') && welcome.includes('Ride into a glowing ring to try a challenge. Earn ⚙ cogs, then spend them in the Shop.') && !welcome.includes('Fresh start') && !/Tune|🚲/.test(welcome), `the welcome card (${JSON.stringify(welcome)})`);
check(await ev(`Math.hypot(window.__lab.s.pos.x - window.__lab.course.stations['Jumps M'].pos.x, window.__lab.s.pos.z - window.__lab.course.stations['Jumps M'].pos.z) < 6`), 'started at Jumps M');

// ---- Back after leaving (iPad swipe-back): the back-forward cache brings the page back with its JS state, so the
// one-tap guards must reset and the map and Who's riding must redraw from the save (cogs or names may have changed)
await go('?rider=0');
await until(`!!document.querySelector('#hub .pin')`, 8000);
await click('#hub .pin[data-place="shredderHills"]'); await sleep(200);
await click('#hub .sheet .row[data-c="goatUp"] button.go');
await until(`location.search === '?rider=0&go=goatUp'`, 5000);
await until(`!!window.__game`, 20000);
await ev(`history.back()`);
// Chromium does restore this page from the cache, but under the dev server Vite's client then reloads it (its socket
// was closed while cached), so let that settle; the simulated restore below is the exact proof
await sleep(1500);
await until(`location.search === '?rider=0' && !!document.querySelector('#hub .pin')`, 8000);
console.log(`(info) back to the map: ${await ev(`performance.getEntriesByType('navigation')[0]?.type`)}`);
await click('#hub .pin[data-place="shredderHills"]'); await sleep(200);
await click('#hub .sheet button[data-at="Trailhead"]');
check(await until(`location.search === '?rider=0&at=Trailhead'`, 5000), `after Back from a ride, a warp still works (${await ev('location.search')})`);
await go('?rider=0'); await until(`!!document.querySelector('#hub .pin')`, 8000);
// simulated: tap Go but stop the page load (the guard is now set), change the save as a ride would, then the
// back-forward cache's pageshow
await sleep(500);
await click('#hub .pin[data-place="shredderHills"]');
check(await until(`!!document.querySelector('#hub .sheet:not([hidden]) .row[data-c="goatUp"] button.go')`, 3000), `the map's sheet opens (${await ev('location.href')})`);
await ev(`(() => { document.querySelector('#hub .sheet .row[data-c="goatUp"] button.go').click(); window.stop(); })()`);
await sleep(300);
// a whole v2 save, as the game writes it (the fresh save may not exist yet)
const rider = (name, cogs) => ({ name, cogs, riding: 'hardtail', bikes: { hardtail: { parts: [], fitted: {}, color: 0x7d8a96 } }, stars: {}, paid: {} });
const setSave = (a, b) => ev(`localStorage.setItem('shredder-save', ${JSON.stringify(JSON.stringify({ version: 2, riders: [a, b] }))})`);
await setSave(rider('Back Again', 7), rider('Rider 2', 0));
check(await ev(`location.search === '?rider=0'`), `the stopped Go left us on the map (${await ev('location.search')})`);
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
await sleep(200);
const barBack = await text('#hub .bar');
check(!!barBack && barBack.includes('7 ⚙') && barBack.includes('Back Again'), `pageshow from the cache redraws the map from the save (${JSON.stringify(barBack)})`);
await click('#hub .pin[data-place="shredderHills"]'); await sleep(200);
await click('#hub .sheet .row[data-c="goatDown"] button.go');
check(await until(`location.search === '?rider=0&go=goatDown'`, 5000), `after pageshow, Go works again (${await ev('location.search')})`);
// the same for Who's riding: Ride! stopped mid-load leaves it "loading"; pageshow clears it and redraws the names
await go('');
await until(`document.querySelectorAll('#who .rider').length === 2`, 8000);
await ev(`(() => { document.querySelector('#who .rider[data-i="1"] .go').click(); window.stop(); })()`);
await sleep(300);
await setSave(rider('Rider 1', 0), rider('Renamed', 0));
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
await sleep(200);
check(await ev(`!document.getElementById('who').classList.contains('loading') && document.querySelector('#who .rider[data-i="1"] b')?.innerText === 'Renamed'`), `pageshow clears Who's riding's loading and redraws the names (${JSON.stringify(await text('#who .riders'))})`);
await click('#who .rider[data-i="1"] .go');
check(await until(`location.search === '?rider=1'`, 5000), `after pageshow, Ride! works again (${await ev('location.search')})`);
// put the names back for the lines below
await setSave(rider('Rider 1', 0), rider('Rider 2', 0));

// ---- the Switch rider button on the map
await go('?rider=0');
await until(`!!document.querySelector('#hub .switch')`, 8000);
await click('#hub .switch');
check(await until(`location.search === '' && document.querySelectorAll('#who .rider').length === 2`, 8000), 'Switch rider on the map → Who\'s riding');

// ---- the ride never writes a stale save: Back can restore a ride page from the back-forward cache after the rider
// earned cogs elsewhere (or the other rider played)
const owner = (name, cogs) => ({ ...rider(name, cogs), riding: 'enduro', bikes: { hardtail: { parts: [], fitted: {}, color: 0x7d8a96 }, enduro: { parts: [], fitted: {}, color: 0x1f8a8a } } });
await setSave(owner('Rider 1', 10), rider('Rider 2', 50));
await ev(`localStorage.setItem('shredder-welcomed-2', '["Rider 1","Rider 2"]')`);
await go('?rider=0&at=Street');
check(await until(`!!window.__game && !!window.__lab`, 20000), 'a ride for the stale-save lines');
await sleep(500);
// a restore from the cache: the page reloads (fresh from the save; a countdown left running dies with it)
await ev(`window.__stale = 1`);
await setSave(owner('Rider 1', 110), rider('Rider 2', 50));
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
check(await until(`!window.__stale && !!window.__game && !!window.__lab`, 20000), `pageshow from the cache reloads the ride (still the old page: ${await ev('window.__stale === 1')})`);
await sleep(500);
// changes made outside this page (the other rider played; this rider earned cogs) survive a swap and a payout here
await setSave(owner('Rider 1', 140), { ...rider('Outside', 999), stars: { goatUp: 2 } });
await ev(`window.__lab.swap()`); await sleep(200);
const afterSwap = await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders`);
check(afterSwap?.[1]?.name === 'Outside' && afterSwap[1].cogs === 999 && afterSwap[1].stars?.goatUp === 2, `a swap leaves the other rider as saved elsewhere (${JSON.stringify(afterSwap?.[1])})`);
check(afterSwap?.[0]?.cogs === 140 && afterSwap[0].riding === 'hardtail', `a swap keeps this rider's cogs from elsewhere (${JSON.stringify(afterSwap?.[0] && { cogs: afterSwap[0].cogs, riding: afterSwap[0].riding })})`);
await ev(`window.__game.start('tableSmall')`);
check(await until(`window.__game.run()?.def.id === 'tableSmall'`, 8000) && await driveLane(10) && await until(`window.__game.modal() === 'card'`, 4000), 'Table Row Small finishes on that page');
const afterPay = await ev(`JSON.parse(localStorage.getItem('shredder-save')).riders`);
check(afterPay?.[0]?.cogs === 140 + T1 && afterPay[0].stars?.tableSmall === 1 && afterPay[1]?.name === 'Outside' && afterPay[1].cogs === 999, `paid on top of the outside cogs (140 + ${T1}), the other rider intact (${JSON.stringify(afterPay?.map((p) => ({ name: p.name, cogs: p.cogs })))})`);
await setSave(rider('Rider 1', 0), rider('Rider 2', 0));

// ---- the Garage: the bike on its stand with five dots; tap Tires → the stock tires (on now) and Sticky (shop, price);
// Buy, Put it on, Specs, Paint, the 👤 button, drag to spin, another owned bike, Ride this one, Back, pageshow
const garageOpen = `!!window.__stand && document.querySelectorAll('#hub .garage .dot').length === 5`;
const cogsShown = () => ev(`document.querySelector('#hub .garage .bar .cogs')?.innerText ?? null`);
const saved0 = () => ev(`JSON.parse(localStorage.getItem('shredder-save')).riders[0]`);
const statV = (stat) => ev(`Number(document.querySelector('#hub .garage .specs .stat[data-stat="${stat}"]')?.dataset.v ?? NaN)`);
// each dot's centre and opacity, from the screen
const dotsNow = () => ev(`[...document.querySelectorAll('#hub .garage .dot')].map((d) => { const r = d.getBoundingClientRect(); return { slot: d.dataset.slot, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, o: Number(getComputedStyle(d).opacity), shown: !d.hidden && getComputedStyle(d).display !== 'none' }; })`);
await setSave(rider('Rider 1', 200), rider('Rider 2', 0));
await go('?rider=0');
await until(`!!document.querySelector('#hub .pin[data-place="garage"]')`, 8000);
await click('#hub .pin[data-place="garage"]');
check(await until(`location.search === '?rider=0&view=garage'`, 5000), `Garage pin → ?rider=0&view=garage (${await ev('location.search')})`);
check(await until(garageOpen, 10000), 'the Garage shows the stand and five dots');
check(await ev(`window.__stand?.bike() === 'hardtail'`), `the stand holds the hardtail (${await ev('window.__stand?.bike()')})`);
check(await ev(`window.__stand?.riderVisible() === true`), 'the rider is on the bike');
await sleep(600);
const dots0 = await dotsNow();
check(dots0?.length === 5 && JSON.stringify(dots0.map((d) => d.slot)) === JSON.stringify(['suspension', 'tires', 'brakes', 'cockpit', 'drivetrain']), `a dot per slot (${JSON.stringify(dots0?.map((d) => d.slot))})`);
check(dots0?.every((d) => d.shown && d.x > 0 && d.y > 0 && d.x < 1180 && d.y < 820), `every dot sits on screen (${JSON.stringify(dots0?.map((d) => [d.slot, Math.round(d.x), Math.round(d.y)]))})`);
check((await ev(`document.querySelector('#hub .garage .bar')?.innerText ?? ''`)).includes('Rider 1') && (await cogsShown())?.includes('200 ⚙'), `the bar: Rider 1's garage, 200 ⚙ (${await cogsShown()})`);
// the Specs tab before anything changes
await click('#hub .garage .tab[data-tab="specs"]'); await sleep(200);
const specs0 = await text('#hub .garage .specs');
const grip0 = await statV('grip');
check(!!specs0 && specs0.includes('Hand-me-down Hardtail') && specs0.includes('Hardtail') && specs0.includes('27.5"') && specs0.includes('68°') && specs0.includes('1130 mm') && specs0.includes('420 mm') && specs0.includes('15.5 kg') && specs0.includes('Worn tires') && specs0.includes('Knobbies · 2.1 in') && !specs0.includes('Sticky'), `Specs: name, type, wheels, geometry, weight, each slot's part and spec (${JSON.stringify(specs0)})`);
const groups0 = await ev(`[...document.querySelectorAll('#hub .garage .specs .statgroup h3')].map((h) => h.innerText.trim())`);
const bars0 = await ev(`[...document.querySelectorAll('#hub .garage .specs .stat')].map((s) => s.dataset.stat)`);
check(JSON.stringify(groups0) === JSON.stringify(['Trail', 'Downhill', 'Park']) && bars0?.length === 8, `Specs: eight bars in Trail, Downhill, Park (${JSON.stringify(groups0)} ${JSON.stringify(bars0)})`);
await shot('87-garage-specs');
await ev(`document.querySelector('#hub .garage .panel').scrollTop = 1e6`); await sleep(150);
await shot('87b-garage-specs-bars');
// tap Tires
await click('#hub .garage .tab[data-tab="parts"]'); await sleep(100);
await click('#hub .garage .dot[data-slot="tires"]');
check(await until(`!!document.querySelector('#hub .garage .card .opt')`, 3000), 'tapping the Tires dot opens its card');
const opts = await ev(`[...document.querySelectorAll('#hub .garage .card .opt')].map((o) => ({ id: o.dataset.part, text: o.innerText }))`);
const stockOpt = opts?.find((o) => o.id === 'hardtail-tires-stock'), stickyOpt = opts?.find((o) => o.id === 'hardtail-sticky-tires');
check(!!stockOpt && stockOpt.text.includes('Worn tires') && /on now/i.test(stockOpt.text), `the card lists the stock tires, on now (${JSON.stringify(stockOpt)})`);
check(!!stickyOpt && stickyOpt.text.includes('Sticky') && stickyOpt.text.includes(`${STICKY} ⚙`), `…and Sticky tires from the shop, ${STICKY} ⚙ (${JSON.stringify(stickyOpt)})`);
const fastOpt = opts?.find((o) => o.id === 'hardtail-fast-tires');
check(!!fastOpt && fastOpt.text.includes('Fast') && /in the shop/i.test(fastOpt.text), `…and Fast tires too, so a lock hint can point at them (${JSON.stringify(fastOpt)})`);
await click('#hub .garage .card .opt[data-part="hardtail-sticky-tires"]'); await sleep(100);
const stickyStats = await ev(`[...document.querySelectorAll('#hub .garage .card .stat')].map((s) => [s.dataset.stat, s.classList.contains('gain') ? 'gain' : s.classList.contains('loss') ? 'loss' : ''])`);
check(stickyStats?.some(([s, k]) => s === 'grip' && k === 'gain') && stickyStats.every(([, k]) => k) && stickyStats.length < 8, `Sticky's card shows only the stats it moves, Grip up (${JSON.stringify(stickyStats)})`);
const buyText = await text('#hub .garage .card .buy');
check(!!buyText && buyText.includes(`${STICKY} ⚙`), `Buy shows the price (${JSON.stringify(buyText)})`);
await shot('88-garage-parts');
// a real double tap (Review Focus 2): two touches at Buy's spot on screen, 80 ms apart, so the second lands on whatever
// the first one left there. Every save this rider's cogs reach, and what each tap hit, are logged in the page.
await ev(`(() => { window.__cogLog = []; window.__taps = []; const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === 'shredder-save') window.__cogLog.push(JSON.parse(v).riders[0].cogs); return set.call(this, k, v); };
  document.addEventListener('pointerup', (e) => window.__taps.push(e.target.closest('button')?.className ?? e.target.tagName), true); return true; })()`);
const buyAt = await centre('#hub .garage .card .buy');
await tapAt(...buyAt); await sleep(80); await tapAt(...buyAt);
await sleep(800); // (buttons press on a touch's lift now; a click within 700 ms of one is taken for that tap's own)
const taps = await ev(`window.__taps`), cogLog = await ev(`window.__cogLog`);
console.log(`(info) the two taps hit: ${JSON.stringify(taps)}; cogs at each save: ${JSON.stringify(cogLog)}`);
check(taps?.length === 2 && /\bbuy\b/.test(taps[0]), `both real taps reached the page, the first on Buy (${JSON.stringify(taps)})`);
check((await saved0())?.cogs === 200 - STICKY && (await cogsShown())?.includes(`${200 - STICKY} ⚙`), `Buy double-tapped → ${200 - STICKY} ⚙, charged once (${await cogsShown()} / ${(await saved0())?.cogs})`);
check(cogLog?.length >= 1 && cogLog.every((c) => c === 200 - STICKY), `no save ever charged twice or went negative (cogs at each save: ${JSON.stringify(cogLog)})`);
check((await saved0())?.bikes.hardtail.parts.filter((x) => x === 'hardtail-sticky-tires').length === 1, 'Sticky tires on the wall once (saved)');
// the second tap lands on Put it on (Buy's spot after buying) and is ignored: a double tap on Buy only buys
if ((await saved0())?.bikes.hardtail.fitted.tires !== 'hardtail-sticky-tires') {
  check(await until(`!!document.querySelector('#hub .garage .card .fit')`, 2000), `…with Put it on (${await text('#hub .garage .card')})`);
  await click('#hub .garage .card .fit'); await sleep(200);
}
check((await saved0())?.bikes.hardtail.fitted.tires === 'hardtail-sticky-tires' && (await text('#hub .garage .card .onnow'))?.includes('On your bike'), `Put it on fits them (saved ${JSON.stringify((await saved0())?.bikes.hardtail.fitted)})`);
await click('#hub .garage .tab[data-tab="specs"]'); await sleep(200);
const specs1 = await text('#hub .garage .specs');
const grip1 = await statV('grip');
check(!!specs1 && specs1.includes('Sticky') && specs1.includes('15.8 kg'), `Specs lists Sticky, weight with the part (${JSON.stringify(specs1)})`);
check(grip1 > grip0, `the Grip bar is higher than before (${grip0} → ${grip1})`);
// a buy with too few cogs: the next one is short
await click('#hub .garage .tab[data-tab="parts"]'); await sleep(100);
await setSave({ ...(await saved0()), cogs: 10 }, rider('Rider 2', 0));
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
check(await until(garageOpen, 8000) && (await cogsShown())?.includes('10 ⚙'), `pageshow from the cache redraws the Garage from the save (${await cogsShown()})`);
await click('#hub .garage .dot[data-slot="brakes"]'); await sleep(100);
await click('#hub .garage .card .opt[data-part="hardtail-hydraulic-brakes"]'); await sleep(100);
check(await ev(`(() => { const b = document.querySelector('#hub .garage .card .buy'); return !!b && b.disabled && b.innerText.includes('Need ${BRAKES - 10} more ⚙'); })()`), `too few cogs: Buy reads "Need ${BRAKES - 10} more ⚙", disabled (${JSON.stringify(await text('#hub .garage .card .buy'))})`);
await click('#hub .garage .card .buy'); await sleep(100);
check((await saved0())?.cogs === 10, 'a disabled Buy charges nothing');
// one cog short: two real taps on the disabled Buy charge nothing and buy nothing
await setSave({ ...(await saved0()), cogs: BRAKES - 1 }, rider('Rider 2', 0));
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
await until(garageOpen, 8000);
await click('#hub .garage .dot[data-slot="brakes"]'); await sleep(100);
await click('#hub .garage .card .opt[data-part="hardtail-hydraulic-brakes"]'); await sleep(100);
check(await ev(`(() => { const b = document.querySelector('#hub .garage .card .buy'); return !!b && b.disabled && b.innerText.includes('Need 1 more ⚙'); })()`), `${BRAKES - 1} cogs for a ${BRAKES} ⚙ part: "Need 1 more ⚙", disabled (${JSON.stringify(await text('#hub .garage .card .buy'))})`);
const shortAt = await centre('#hub .garage .card .buy');
await ev(`(window.__cogLog = [], true)`);
await tapAt(...shortAt); await sleep(80); await tapAt(...shortAt); await sleep(800);
const shortSaved = await saved0();
check(shortSaved?.cogs === BRAKES - 1 && !shortSaved.bikes.hardtail.parts.includes('hardtail-hydraulic-brakes') && (await ev(`window.__cogLog`))?.length === 0, `two taps on the disabled Buy: still ${BRAKES - 1} ⚙, nothing bought, nothing saved (${shortSaved?.cogs}, ${JSON.stringify(await ev('window.__cogLog'))})`);
// Paint
await click('#hub .garage .tab[data-tab="paint"]'); await sleep(100);
const color0 = await ev(`window.__stand.frameColor()`);
const swatches = await ev(`[...document.querySelectorAll('#hub .garage .swatch')].map((s) => Number(s.dataset.color))`);
check(swatches?.length >= 8, `Paint: a row of swatches (${swatches?.length})`);
const pick = swatches?.find((c) => c !== color0 && c === 0xe63946);
await click(`#hub .garage .swatch[data-color="${pick}"]`); await sleep(200);
check(await ev(`window.__stand.frameColor()`) === pick && pick !== color0, `a swatch repaints the frame (${color0} → ${await ev('window.__stand.frameColor()')})`);
check((await saved0())?.bikes.hardtail.color === pick, 'the paint is saved');
await shot('89-garage-paint');
// the 👤 button
await click('#hub .garage .rider-toggle'); await sleep(100);
check(await ev(`window.__stand.riderVisible() === false`), '👤 hides the rider');
await shot('90-garage-no-rider');
await click('#hub .garage .rider-toggle'); await sleep(100);
check(await ev(`window.__stand.riderVisible() === true`), '👤 again shows the rider');
// drag to spin: half a turn moves the dots, and some dot fades behind the bike at some angle
const cv = `document.querySelector('#hub .garage canvas')`;
const drag = (dx) => ev(`(() => { const c = ${cv}, r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const p = (type, cx) => c.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true }));
  p('pointerdown', x); for (let i = 1; i <= 10; i++) p('pointermove', x + ${dx} * i / 10); p('pointerup', x + ${dx}); return true; })()`);
const before180 = await dotsNow();
let faded = before180?.some((d) => d.o < 0.9) ?? false;
for (let i = 0; i < 6; i++) { await drag(60); await sleep(80); faded ||= (await dotsNow())?.some((d) => d.o < 0.9); }
const after180 = await dotsNow();
check(after180?.some((d, i) => Math.hypot(d.x - before180[i].x, d.y - before180[i].y) > 20), 'dragging spins the stand (the dots move)');
check(faded, 'a dot behind the bike or rider fades');
check(after180?.every((d) => d.w >= 44 && d.h >= 44), `every dot is at least 44 px (${JSON.stringify(after180?.map((d) => [d.w, d.h]))})`);
const garageSmall = await small('#hub');
check(garageSmall?.length === 0, `Garage: nothing under 44 px (${JSON.stringify(garageSmall)})`);
check(!/🔩|bolts/.test(await text('#hub') ?? ''), 'no bolts in the Garage');
// another owned bike: the strip switches the stand, Ride this one sets riding
await setSave({ ...owner('Rider 1', 0), riding: 'hardtail' }, rider('Rider 2', 0));
await go('?rider=0&view=garage');
check(await until(garageOpen, 10000), 'the Garage again, owning the enduro too');
const strip = await ev(`[...document.querySelectorAll('#hub .garage .bikes .bike')].map((b) => b.dataset.bike)`);
check(JSON.stringify(strip?.slice().sort()) === JSON.stringify(['enduro', 'hardtail']), `the strip shows the bikes you own (${JSON.stringify(strip)})`);
await click('#hub .garage .bikes .bike[data-bike="enduro"]');
check(await until(`window.__stand.bike() === 'enduro' && document.querySelectorAll('#hub .garage .dot').length === 5`, 5000), 'tapping the enduro puts it on the stand');
check((await saved0())?.riding === 'hardtail', 'looking at a bike does not change what you ride');
await click('#hub .garage .ride-this');
await sleep(200);
check((await saved0())?.riding === 'enduro', `Ride this one → riding the enduro (${(await saved0())?.riding})`);
check(!(await ev(`!!document.querySelector('#hub .garage .ride-this')`)), 'Ride this one goes once it is the bike you ride');
await shot('91-garage-enduro');
// Back → the map, which shows the bike you ride now
await click('#hub .garage .back');
check(await until(`location.search === '?rider=0' && !!document.querySelector('#hub .pin')`, 8000), `Back → the map (${await ev('location.search')})`);
check((await text('#hub .bar'))?.includes('Teal Enduro'), `the map shows the enduro (${JSON.stringify(await text('#hub .bar'))})`);
await setSave(rider('Rider 1', 0), rider('Rider 2', 0));

// ---- the Shop: Bikes (unowned ones on the stand, sheet, bars, price, Buy) and Parts (per owned bike); Review Focus 2
const shopOpen = `!!window.__stand && !!document.querySelector('#hub .shop .panel')`;
const shopCogs = () => ev(`document.querySelector('#hub .shop .bar .cogs')?.innerText ?? null`);
const bikeBtn = (b) => `#hub .shop .bikes .bike[data-bike="${b}"]`;
await setSave(rider('Rider 1', DJ - 1), rider('Rider 2', 0));
await go('?rider=0');
await until(`!!document.querySelector('#hub .pin[data-place="shop"]')`, 8000);
await click('#hub .pin[data-place="shop"]');
check(await until(`location.search === '?rider=0&view=shop'`, 5000), `Shop pin → ?rider=0&view=shop (${await ev('location.search')})`);
check(await until(shopOpen, 10000), 'the Shop shows the stand');
check(await ev(`document.querySelectorAll('#hub .shop .tab').length === 2`) && (await text('#hub .shop .tabs'))?.includes('Bikes') && (await text('#hub .shop .tabs'))?.includes('Parts'), 'two tabs: Bikes, Parts');
const shopBikes = await ev(`[...document.querySelectorAll('#hub .shop .bikes .bike')].map((b) => b.dataset.bike).sort()`);
check(JSON.stringify(shopBikes) === JSON.stringify(['bolinas', 'dirtjumper', 'enduro']), `Bikes lists the three you don't own (${JSON.stringify(shopBikes)})`);
check(await ev(`window.__stand.riderVisible() === true`), 'the rider is on the bike in the Shop');
await click(bikeBtn('dirtjumper')); await sleep(300);
check(await ev(`window.__stand.bike() === 'dirtjumper'`), `the Dirt Jumper is on the stand (${await ev('window.__stand.bike()')})`);
const djPanel = await text('#hub .shop .panel');
check(!!djPanel && djPanel.includes('Dirt Jumper') && djPanel.includes('26"') && djPanel.includes(String(DJ)), `the sheet and price show (${JSON.stringify(djPanel?.slice(0, 120))})`);
check(await ev(`document.querySelectorAll('#hub .shop .panel .stat').length === 8`), 'eight stat bars');
check(await ev(`(() => { const b = document.querySelector('#hub .shop .panel .buy'); return !!b && b.disabled && b.innerText.includes('Need 1 more ⚙'); })()`), `${DJ - 1} ⚙: Buy is disabled and reads "Need 1 more ⚙" (${JSON.stringify(await text('#hub .shop .panel .buy'))})`);
await shot('92-shop-bikes');
const shortAt2 = await centre('#hub .shop .panel .buy');
await ev(`(window.__cogLog = [], Storage.prototype.setItem = (function (set) { return function (k, v) { if (k === 'shredder-save') window.__cogLog.push(JSON.parse(v).riders[0].cogs); return set.call(this, k, v); }; })(Storage.prototype.setItem), true)`);
await tapAt(...shortAt2); await sleep(80); await tapAt(...shortAt2); await sleep(800);
check((await saved0())?.cogs === DJ - 1 && !(await saved0())?.bikes.dirtjumper && (await ev(`window.__cogLog`))?.length === 0, `two taps on the disabled Buy: still ${DJ - 1} ⚙, nothing bought, nothing saved`);
// one more cog arrives (another page wrote it): the Shop re-reads on pageshow, Buy is live, a double tap charges once
await setSave({ ...(await saved0()), cogs: DJ }, rider('Rider 2', 0));
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
check(await until(shopOpen, 8000) && (await shopCogs())?.includes(`${DJ} ⚙`), `pageshow redraws the Shop from the save (${await shopCogs()})`);
await click(bikeBtn('dirtjumper')); await sleep(200);
check(await ev(`(() => { const b = document.querySelector('#hub .shop .panel .buy'); return !!b && !b.disabled && b.innerText.includes('${DJ}'); })()`), `${DJ} ⚙: Buy is live (${JSON.stringify(await text('#hub .shop .panel .buy'))})`);
await ev(`(window.__cogLog = [], window.__taps = [], document.addEventListener('pointerup', (e) => window.__taps.push(e.target.closest('button')?.className ?? e.target.tagName), true), true)`);
const djBuyAt = await centre('#hub .shop .panel .buy');
await tapAt(...djBuyAt); await sleep(80); await tapAt(...djBuyAt); await sleep(800);
const shopTaps = await ev(`window.__taps`), shopLog = await ev(`window.__cogLog`);
console.log(`(info) the two taps hit: ${JSON.stringify(shopTaps)}; cogs at each save: ${JSON.stringify(shopLog)}`);
check(shopTaps?.length === 2 && /\bbuy\b/.test(shopTaps[0]), 'both real taps reached the page, the first on Buy');
const bought = await saved0();
check(bought?.cogs === 0 && !!bought.bikes.dirtjumper && Object.keys(bought.bikes).length === 2, `Buy double-tapped → 0 ⚙, charged once, the Dirt Jumper owned (${bought?.cogs}, ${Object.keys(bought?.bikes ?? {})})`);
check(shopLog?.length === 1 && shopLog[0] === 0, `exactly one save, never negative (${JSON.stringify(shopLog)})`);
check((await shopCogs())?.includes('0 ⚙'), 'the bar shows 0 ⚙');
const afterBuy = await text('#hub .shop .panel');
check(!!afterBuy && afterBuy.includes('In your garage') && await ev(`!document.querySelector('#hub .shop .panel .buy')`), `the button became "In your garage", no Buy left (${JSON.stringify(afterBuy?.slice(0, 80))})`);
check(await shown('#hub .shop .note'), 'a "Bought!" toast shows');
check(bought?.riding === 'dirtjumper' && /riding it/i.test(await text('#hub .shop .note') ?? ''), `buying a bike makes it the one you ride (saved riding ${bought?.riding}; toast ${JSON.stringify(await text('#hub .shop .note'))})`);
await shot('93-shop-bought');
// Parts tab: the Dirt Jumper's parts, grouped by bike
await click('#hub .shop .tab[data-tab="parts"]'); await sleep(300);
const shopParts = await ev(`[...document.querySelectorAll('#hub .shop .panel .part')].map((p) => ({ id: p.dataset.part, bike: p.dataset.bike, text: p.innerText }))`);
const djIds = shopParts?.filter((p) => p.bike === 'dirtjumper').map((p) => p.id).sort();
check(JSON.stringify(djIds) === JSON.stringify(['dirtjumper-big-gear', 'dirtjumper-fast-tires', 'dirtjumper-small-gear']), `Parts lists the Dirt Jumper's non-stock parts incl. both gears (${JSON.stringify(djIds)})`);
check(shopParts?.some((p) => p.bike === 'hardtail') && shopParts.every((p) => !/-stock$/.test(p.id)), 'the hardtail has its parts too, and no stock parts anywhere');
const bigGear = shopParts?.find((p) => p.id === 'dirtjumper-big-gear');
check(!!bigGear && bigGear.text.includes('Big gear') && bigGear.text.includes('28/11') && bigGear.text.includes(String(BIG)) && new RegExp(`need ${BIG} more`, 'i').test(bigGear.text), `a part card shows name, spec, price, and that ${BIG} more are needed (${JSON.stringify(bigGear?.text)})`);
const bigStats = await ev(`[...document.querySelectorAll('#hub .shop .part[data-part="dirtjumper-big-gear"] .stat')].map((s) => [s.dataset.stat, s.classList.contains('gain') ? 'gain' : s.classList.contains('loss') ? 'loss' : ''])`);
check(bigStats?.length > 0 && bigStats.length < 8 && bigStats.every(([, k]) => k), `the card shows only the stats it moves (${JSON.stringify(bigStats)})`);
check(await ev(`document.querySelector('#hub .shop .part[data-part="dirtjumper-small-gear"] .does')?.innerText.length > 5`), 'each part shows its "does" line');
await click('#hub .shop .part[data-part="dirtjumper-fast-tires"]'); await sleep(250);
check(await ev(`window.__stand.bike() === 'dirtjumper'`), 'tapping a Dirt Jumper part puts the Dirt Jumper on the stand');
await shot('94-shop-parts');
// a part with enough cogs: a double tap charges once
await setSave({ ...(await saved0()), cogs: FAST + 5 }, rider('Rider 2', 0));
await ev(`window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))`);
await until(shopOpen, 8000); await click('#hub .shop .tab[data-tab="parts"]'); await sleep(200);
await ev(`(window.__cogLog = [], true)`);
await ev(`document.querySelector('#hub .shop .part[data-part="dirtjumper-fast-tires"]').scrollIntoView({ block: 'center' })`); await sleep(150);
const ftBuy = await centre('#hub .shop .part[data-part="dirtjumper-fast-tires"] .buy');
await tapAt(...ftBuy); await sleep(80); await tapAt(...ftBuy); await sleep(800);
const afterPart = await saved0();
check(afterPart?.cogs === 5 && afterPart.bikes.dirtjumper.parts.filter((x) => x === 'dirtjumper-fast-tires').length === 1 && (await ev(`window.__cogLog`)).every((c) => c === 5), `a part double-tapped: ${FAST + 5} → 5 ⚙, owned once (${afterPart?.cogs}, cogs per save ${JSON.stringify(await ev('window.__cogLog'))})`);
check((await text('#hub .shop .part[data-part="dirtjumper-fast-tires"]'))?.includes('In your garage') && await ev(`!document.querySelector('#hub .shop .part[data-part="dirtjumper-fast-tires"] .buy')`), 'the bought part reads "In your garage"');
const shopSmall = await small('#hub');
check(shopSmall?.length === 0, `Shop: nothing under 44 px (${JSON.stringify(shopSmall)})`);
check(!/🔩|bolts/.test(await text('#hub') ?? ''), 'no bolts in the Shop');
await click('#hub .shop .back');
check(await until(`location.search === '?rider=0' && !!document.querySelector('#hub .pin')`, 8000), `Shop Back → the map (${await ev('location.search')})`);
await go('?rider=0&view=garage');
check(await until(garageOpen, 10000), 'Garage after the buy');
const strip2 = await ev(`[...document.querySelectorAll('#hub .garage .bikes .bike')].map((b) => b.dataset.bike).sort()`);
check(JSON.stringify(strip2) === JSON.stringify(['dirtjumper', 'hardtail']), `the Garage strip shows two bikes (${JSON.stringify(strip2)})`);
await go('?rider=0&view=shop');
await until(shopOpen, 10000);
const shopBikes2 = await ev(`[...document.querySelectorAll('#hub .shop .bikes .bike')].map((b) => b.dataset.bike).sort()`);
check(JSON.stringify(shopBikes2) === JSON.stringify(['bolinas', 'enduro']), `reopened, the Shop offers only the two you don't own (${JSON.stringify(shopBikes2)})`);
await setSave(rider('Rider 1', 0), rider('Rider 2', 0));

for (const q of ['?rider=5', '?rider=-1', '?rider=abc', '?rider=2&go=tableSmall']) {
  await go(q);
  check(await until(`document.querySelectorAll('#who .rider').length === 2 && !document.querySelector('#hub .pin')`, 8000), `${q}: Who's riding`);
}
await shot('85-rider5');

// ---- ?bike= still rides straight away and saves nothing, even finishing a challenge (Review Focus 5)
const before = await ev(`localStorage.getItem('shredder-save')`);
await go('?bike=enduro&at=Street');
check(await until(`!!window.__lab && window.__lab.bike() === 'enduro'`, 20000), '?bike=enduro rides the enduro');
check(await ev(`!document.getElementById('who') && !document.querySelector('#hub .pin')`), '?bike=: no Who\'s riding, no map');
check(await ev(`localStorage.getItem('shredder-save')`) === before, '?bike= left the save as it was');
await go('?bike=enduro&go=tableSmall');
check(await until(`!!window.__game && window.__game.run()?.def.id === 'tableSmall'`, 20000), '?bike=enduro&go=tableSmall runs');
check(await driveLane(10) && await until(`window.__game.modal() === 'card'`, 4000), '?bike=: Table Row Small finishes');
const quickResult = await text('#lab .card');
check(!!quickResult && quickResult.includes('★') && !quickResult.includes('⚙'), `?bike= result: stars, no pay (${JSON.stringify(quickResult)})`);
check(await ev(`localStorage.getItem('shredder-save')`) === before, '?bike= finishing a challenge left the save as it was');
await click('#lab .card .close'); await sleep(200);
await click('#lab .menu .m-map');
check(await until(`location.search === '' && document.querySelectorAll('#who .rider').length === 2`, 8000), `?bike=: 🗺 Map → Who's riding (${await ev('location.href')})`);
check(await ev(`localStorage.getItem('shredder-save')`) === before, '…and still no save');

check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
