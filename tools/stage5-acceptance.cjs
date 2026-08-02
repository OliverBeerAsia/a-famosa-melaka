#!/usr/bin/env node
/**
 * stage5-acceptance.cjs — drive the Stage 5 acceptance checks in a real browser.
 *
 * The living-world spec's section 8 is fifteen things a tester can SIT DOWN AND
 * OBSERVE, which means none of them can be settled by a unit test: they are
 * questions about where fourteen people are standing at 19:00 and whether the
 * watchman is where the timetable says. This drives the dev server through the
 * DEV acceptance hook (`window.__melakaDebug`) and writes screenshots.
 *
 * Usage: node tools/stage5-acceptance.cjs [--url http://localhost:3900]
 * Screenshots and a results.json land in docs/design/stage5-shots/.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL = (() => {
  const i = process.argv.indexOf('--url');
  return i >= 0 ? process.argv[i + 1] : 'http://localhost:3900/';
})();
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

  const started = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((b) => /new game|continue|begin|start/i.test(b.textContent || ''));
    if (button) { button.click(); return button.textContent.trim(); }
    return null;
  });
  console.log('start button:', started);

  await page.waitForFunction(() => Boolean(window.__melakaDebug), null, { timeout: 45000 });
  await sleep(3000);
  // Pin the visual tier: a headless capture is always a slow frame, and the
  // dynamic governor would otherwise silently measure the `low` profile.
  await page.evaluate(() => window.__melakaDebug.setQuality?.('balanced', false));

  const results = {};
  const probe = () => page.evaluate(() => {
    const g = window.__melakaDebug;
    return {
      clock: g.clock(),
      location: g.location(),
      timeOfDay: g.timeOfDay(),
      counts: g.counts(),
      npcs: g.npcs().filter((n) => n.id).map((n) => `${n.id}@${Math.round(n.x / 3)},${Math.round(n.y / 3)}`),
      residents: g.residents().map((r) => `${r.id}@${Math.round(r.x / 3)},${Math.round(r.y / 3)}`),
      nightWatch: g.nightWatch(),
    };
  });

  const record = async (name) => {
    const value = await probe();
    results[name] = value;
    console.log(`\n== ${name} @ ${value.location} ${value.clock.hour}:${String(value.clock.minute).padStart(2, '0')} (${value.timeOfDay})`);
    console.log('   counts    ', JSON.stringify(value.counts));
    console.log('   npcs      ', value.npcs.join(' | ') || '(none)');
    console.log('   residents ', value.residents.join(' | ') || '(none)');
    if (value.nightWatch.onDuty) console.log('   watch     ', JSON.stringify(value.nightWatch));
    return value;
  };

  const shot = async (name) => {
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  };

  const travel = async (loc, settle = 5000) => {
    await page.evaluate((l) => window.__melakaDebug.travel(l), loc);
    await sleep(settle);
  };

  /** Move the clock to a target hour in whole steps, then let systems settle. */
  const setHour = async (target, settle = 4000) => {
    const now = await page.evaluate(() => window.__melakaDebug.clock().hour);
    const delta = ((target - now) + 24) % 24;
    if (delta > 0) await page.evaluate((d) => window.__melakaDebug.advanceTime(d), delta);
    await sleep(settle);
  };

  // ---- A2: Aminah's 19:00 signature transit -------------------------------
  //
  // This one CANNOT be driven by jumping the clock. `arriveBy` is a deadline
  // and the walk starts (deadline - travel time), which for a 1500px crossing
  // is about twelve game minutes before the hour — so a harness that teleports
  // from 18:00 to 19:00 skips the entire thing it is trying to observe. The
  // clock runs at one game minute per 2.5 real seconds, so we set 18:00 and
  // then WATCH for two and a half real minutes, which is what a player does.
  await travel('rua-direita');
  await setHour(18);
  await record('A2-rua-1800');
  await shot('A2-rua-1800');

  const aminahTrack = [];
  let shotIndex = 0;
  for (let i = 0; i < 34; i++) {
    await sleep(5000);
    const frame = await page.evaluate(() => {
      const g = window.__melakaDebug;
      const a = g.npcs().find((n) => n.id === 'aminah');
      return {
        clock: g.clock(),
        aminah: a ? { x: Math.round(a.x / 3), y: Math.round(a.y / 3) } : null,
      };
    });
    aminahTrack.push(frame);
    const moving = aminahTrack.length > 1 && frame.aminah && aminahTrack[aminahTrack.length - 2].aminah
      && (Math.abs(frame.aminah.x - aminahTrack[aminahTrack.length - 2].aminah.x) > 2);
    if (moving && shotIndex < 4) { await shot(`A2-transit-${shotIndex++}`); }
    if (frame.clock.hour >= 19 && frame.clock.minute >= 10) break;
  }
  results['A2-aminah-track'] = aminahTrack;
  console.log('\n== A2 Aminah track (5s apart, native px)');
  console.log(aminahTrack.map((f) => `${f.clock.hour}:${String(f.clock.minute).padStart(2, '0')}  ${f.aminah ? `${f.aminah.x},${f.aminah.y}` : 'ABSENT'}`).join('\n'));
  await record('A2-rua-after');
  await shot('A2-rua-after');

  // ---- A9: the Angelus at 12:00 -------------------------------------------
  await setHour(12, 5000);
  await record('A9-rua-1200');
  await shot('A9-rua-1200');

  // ---- A12: midday population --------------------------------------------
  await setHour(13, 8000);
  await record('A12-rua-1300');
  await shot('A12-rua-1300');
  for (const loc of ['waterfront', 'a-famosa-gate', 'kampung', 'st-pauls-church']) {
    await travel(loc, 9000);
    await record(`A12-${loc}-1300`);
    await shot(`A12-${loc}-1300`);
  }

  // ---- A8: Pak Salleh walks to the surau ----------------------------------
  await travel('kampung');
  await setHour(12, 3000);
  await record('A8-kampung-1200');
  await setHour(13, 2000);
  await sleep(2000); await shot('A8-kampung-1300-a');
  await sleep(6000); await record('A8-kampung-1305'); await shot('A8-kampung-1300-b');

  // ---- A10: Chen Wei and Lin Mei lock up at 18:00 -------------------------
  await travel('waterfront');
  await setHour(17, 4000);
  await record('A10-waterfront-1700');
  await setHour(18, 2000);
  await shot('A10-waterfront-1800-a');
  await sleep(6000); await record('A10-waterfront-1800'); await shot('A10-waterfront-1800-b');
  await setHour(19, 5000);
  await record('A10-waterfront-1900'); await shot('A10-waterfront-1900');

  // ---- A3/A4: the night watch --------------------------------------------
  await setHour(23, 5000);
  await record('A3-waterfront-2300');
  await shot('A3-watch-a');
  const watchTrack = [];
  for (let i = 0; i < 12; i++) {
    await sleep(4000);
    const w = await page.evaluate(() => window.__melakaDebug.nightWatch());
    watchTrack.push({ t: (i + 1) * 4, x: w.x === null ? null : Math.round(w.x / 3), y: w.y === null ? null : Math.round(w.y / 3), state: w.state });
    if (i === 3) await shot('A3-watch-b');
    if (i === 7) await shot('A3-watch-c');
  }
  results['A3-patrol-track'] = watchTrack;
  console.log('\n== A3 patrol track (native px, 4s apart)');
  console.log(watchTrack.map((w) => `${w.t}s ${w.x},${w.y} ${w.state}`).join('\n'));
  await shot('A3-watch-d');

  // ---- A11: 23:00 population, and the gate sentry at 03:00 ----------------
  for (const loc of ['a-famosa-gate', 'rua-direita', 'kampung', 'st-pauls-church']) {
    await travel(loc, 7000);
    await record(`A11-${loc}-2300`);
    await shot(`A11-${loc}-2300`);
  }
  await travel('a-famosa-gate');
  await setHour(3, 6000);
  await record('A11b-gate-0300');
  await shot('A11b-gate-0300');

  // ---- A7: Diogo is at A Famosa at 11:00, not on Rua Direita -------------
  await setHour(11, 8000);
  await record('A7-gate-1100');
  await shot('A7-gate-1100');
  await travel('rua-direita', 6000);
  await record('A7-rua-1100');

  fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, errors: [...new Set(errors)] }, null, 2));
  console.log('\n=== console errors ===');
  console.log([...new Set(errors)].slice(0, 30).join('\n') || '(none)');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
