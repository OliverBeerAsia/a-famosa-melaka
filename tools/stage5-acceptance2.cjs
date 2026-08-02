#!/usr/bin/env node
/**
 * stage5-acceptance2.cjs — the assertions that need the player somewhere
 * specific, or that need the clock to RUN rather than jump.
 *
 * A2 (Aminah's transit), A3 (patrol loop time), A4 (detection in shadow vs in
 * the brazier pool), A8 (Pak Salleh at the surau) and A10 (the lock-up) all
 * depend on where the camera is or on game minutes actually elapsing, so they
 * get their own pass with the player deliberately placed.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL = 'http://localhost:3900/';
const SHOTS = path.join(__dirname, '..', 'docs', 'design', 'stage5-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));

  await page.goto(URL, { waitUntil: 'load' });
  await sleep(3000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /new game/i.test(x.textContent || ''));
    b?.click();
  });
  await page.waitForFunction(() => Boolean(window.__melakaDebug), null, { timeout: 45000 });
  await sleep(3000);
  await page.evaluate(() => window.__melakaDebug.setQuality?.('balanced', false));

  const out = {};
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`) });
  const travel = async (loc, s = 6000) => {
    await page.evaluate((l) => window.__melakaDebug.travel(l), loc);
    await sleep(s);
  };
  const place = (nx, ny) => page.evaluate(({ x, y }) => window.__melakaDebug.place(x, y), { x: nx * 3, y: ny * 3 });
  const setHour = async (h, s = 4000) => {
    const now = await page.evaluate(() => window.__melakaDebug.clock().hour);
    const d = ((h - now) + 24) % 24;
    if (d > 0) await page.evaluate((n) => window.__melakaDebug.advanceTime(n), n = d);
    await sleep(s);
  };
  const snap = () => page.evaluate(() => {
    const g = window.__melakaDebug;
    return {
      clock: g.clock(),
      npcs: g.npcs().filter((n) => n.id).map((n) => `${n.id}@${Math.round(n.x / 3)},${Math.round(n.y / 3)}`),
      watch: g.nightWatch(),
      target: g.target(),
    };
  });

  // ---- A8: Pak Salleh kneels at the surau ---------------------------------
  await travel('kampung');
  await setHour(12, 3000);
  await place(400, 280);
  await setHour(13, 6000);
  out.A8 = await snap();
  console.log('A8 kampung 13:00 ->', JSON.stringify(out.A8.npcs));
  await shot('A8-fixed-kampung-1300');
  await sleep(8000);
  out.A8b = await snap();
  console.log('A8 kampung +8s   ->', JSON.stringify(out.A8b.npcs));
  await shot('A8-fixed-kampung-1305');

  // ---- A10: Chen Wei crosses, Lin Mei locks up ----------------------------
  await travel('waterfront');
  await setHour(17, 3000);
  await place(540, 280);          // standing on the quay by the counting house
  await sleep(2000);
  out.A10pre = await snap();
  console.log('A10 17:00 ->', JSON.stringify(out.A10pre.npcs));
  await setHour(18, 1000);
  for (let i = 0; i < 6; i++) {
    await sleep(3000);
    const s = await snap();
    console.log(`A10 18:00+${(i + 1) * 3}s ->`, JSON.stringify(s.npcs));
    if (i === 1) await shot('A10-fixed-1800-a');
    if (i === 4) await shot('A10-fixed-1800-b');
  }
  out.A10 = await snap();
  await setHour(19, 6000);
  out.A10post = await snap();
  console.log('A10 19:00 ->', JSON.stringify(out.A10post.npcs));
  await shot('A10-fixed-1900');

  // ---- A3: one full patrol loop, timed -----------------------------------
  await setHour(23, 4000);
  await place(240, 300);          // the brazier — visible from most of the quay
  await sleep(2000);
  const track = [];
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const w = await page.evaluate(() => window.__melakaDebug.nightWatch());
    track.push({
      t: +((Date.now() - t0) / 1000).toFixed(1),
      x: w.x === null ? null : Math.round(w.x / 3),
      y: w.y === null ? null : Math.round(w.y / 3),
      state: w.state,
    });
    if (i === 2) await shot('A3-fixed-watch-a');
    if (i === 14) await shot('A3-fixed-watch-b');
    if (i === 28) await shot('A3-fixed-watch-c');
  }
  out.A3 = track;
  console.log('\nA3 patrol track (1.5s apart):');
  console.log(track.map((p) => `${String(p.t).padStart(5)}s  ${p.x},${p.y}  ${p.state}`).join('\n'));

  // ---- A4: detection in shadow vs in the brazier pool ---------------------
  //
  // Sampled at 200ms: he covers ~34 native px a second, so a 1.5s sample can
  // step clean over the closest approach and report a miss that never happened.
  // Each sweep first waits for him to settle back to `unaware`, because a
  // suspicious guard is off his timetable and would poison the next reading.
  const probe = () => page.evaluate(() => {
    try { return { w: window.__melakaDebug.nightWatch(), p: window.__melakaDebug.player() }; }
    catch { return null; }
  });

  const sweep = async (label, nx, ny, samples) => {
    for (let i = 0; i < 80; i++) {
      const r = await probe();
      if (r && r.w.state === 'unaware') break;
      await sleep(500);
    }
    await page.evaluate(({ x, y }) => window.__melakaDebug.place(x, y), { x: nx * 3, y: ny * 3 });
    await sleep(1500);
    let closest = 1e9;
    let seenAt = null;
    const states = new Set();
    for (let i = 0; i < samples; i++) {
      await sleep(200);
      const r = await probe();
      if (!r) continue;
      states.add(r.w.state);
      if (r.w.x !== null) {
        const d = Math.hypot(r.w.x - r.p.x, r.w.y - r.p.y) / 3;
        closest = Math.min(closest, d);
        if (r.w.state !== 'unaware' && seenAt === null) seenAt = Math.round(d);
      }
      if (seenAt !== null) break;
    }
    const result = { closest: Math.round(closest), seenAt, states: [...states] };
    out[label] = result;
    console.log(`\n${label}: closest ${result.closest} px | escalated at ${seenAt === null ? 'NEVER' : seenAt + ' px'} | states ${result.states.join(',')}`);
    return result;
  };

  await sweep('A4a-shadow-frozen', 486, 289, 500);
  await shot('A4-frozen-in-shadow');
  await sweep('A4b-brazier-pool', 240, 300, 500);
  await shot('A4-in-the-brazier-pool');

  // ---- Douse a lantern, and open a container ------------------------------
  await page.evaluate(() => window.__melakaDebug.place(632 * 3, 268 * 3));
  await sleep(1200);
  out.douseTarget = await page.evaluate(() => window.__melakaDebug.target());
  console.log('\ndouse target:', JSON.stringify(out.douseTarget));
  await page.evaluate(() => window.__melakaDebug.interact());
  await sleep(1500);
  out.doused = await page.evaluate(() => window.__melakaDebug.nightWatch().dousedLights);
  console.log('doused lights:', JSON.stringify(out.doused));
  await shot('douse-lantern-post-96');

  await page.evaluate(() => window.__melakaDebug.place(478 * 3, 297 * 3));
  await sleep(1200);
  out.chestTarget = await page.evaluate(() => window.__melakaDebug.target());
  console.log('bonded chest target:', JSON.stringify(out.chestTarget));
  await page.evaluate(() => window.__melakaDebug.interact());
  await sleep(1500);
  await shot('openable-bonded-chest-locked');

  fs.writeFileSync(path.join(SHOTS, 'results2.json'), JSON.stringify({ out, errors: [...new Set(errors)] }, null, 2));
  console.log('\nconsole errors:', [...new Set(errors)].slice(0, 20).join('\n') || '(none)');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
