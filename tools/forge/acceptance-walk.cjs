#!/usr/bin/env node
'use strict';
/**
 * Stage-4 in-engine acceptance harness (scratch; not wired into npm scripts).
 *
 * Boots the dev build in headless Chromium, starts a New Game and then, for
 * every location: proves the camera scrolls, screenshots day/dusk/night, and
 * walks EVERY authored transition through the real switchLocation path,
 * reporting where the player actually lands and whether that pixel is walkable.
 *
 *   node tools/forge/acceptance-walk.cjs [--url http://localhost:3400] [--out /tmp/melaka-shots]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const URL = arg('--url', 'http://localhost:3400');
const OUT = arg('--out', '/tmp/melaka-shots');
const FKEY = {
  'a-famosa-gate': 'F6', 'rua-direita': 'F7', 'st-pauls-church': 'F8',
  waterfront: 'F9', kampung: 'F10',
};
const ORDER = ['rua-direita', 'a-famosa-gate', 'waterfront', 'kampung', 'st-pauls-church'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
const log = (s) => { console.log(s); report.push(s); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await sleep(1500);
  // Title screen -> New Game
  const start = page.getByText('New Game', { exact: false }).first();
  await start.click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !!window.__melakaDebug, null, { timeout: 40000 });
  await sleep(2000);
  // Dismiss the controls card, or it covers the middle of every screenshot.
  const begin = page.getByText('Begin Journey', { exact: false }).first();
  if (await begin.count().catch(() => 0)) await begin.click({ timeout: 5000 }).catch(() => {});
  await sleep(1200);
  await page.mouse.click(500, 600);            // focus the canvas for key events

  const D = async (fn, ...a) => {
    // switchLocation restarts the scene, so the hook briefly disappears.
    await page.waitForFunction(() => !!window.__melakaDebug, null, { timeout: 20000 });
    return page.evaluate(fn, ...a);
  };
  const shot = async (name) => {
    const f = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: f });
    return f;
  };
  const goTo = async (id) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.mouse.click(500, 620);        // keep focus on the canvas
      await page.keyboard.press(FKEY[id]);
      await sleep(2400);
      if ((await D(() => window.__melakaDebug.location())) === id) return true;
    }
    log(`  !! could not reach ${id} with ${FKEY[id]}`);
    return false;
  };
  const state = () => D(() => ({
    loc: window.__melakaDebug.location(),
    player: window.__melakaDebug.player(),
    cam: window.__melakaDebug.camera(),
    world: window.__melakaDebug.world(),
    tod: window.__melakaDebug.timeOfDay(),
    counts: window.__melakaDebug.counts(),
  }));

  const setDay = async () => {
    for (let i = 0; i < 9 && (await D(() => window.__melakaDebug.timeOfDay())) !== 'day'; i++) {
      await page.keyboard.press('t');
      await sleep(900);
    }
  };

  // ---- per-location: scroll, time of day, populations ---------------------
  for (const id of ORDER) {
    // Set the clock BEFORE entering. NPCs keep schedules (count them at night
    // and half the cast is at home), and the crowd system culls on every
    // time-of-day change and then refills at one actor per 3000/density ms —
    // so cycling the clock inside the location measures the cull, not the
    // population. Entering at day gives the initial burst a player actually sees.
    await setDay();
    await goTo(id);
    await sleep(3500);
    let s = await state();
    log(`\n### ${id}`);
    log(`  world ${s.world.width}x${s.world.height}  viewport ${s.cam.w}x${s.cam.h}  ` +
        `scrolling=${s.world.width > s.cam.w || s.world.height > s.cam.h}`);
    log(`  counts ${JSON.stringify(s.counts)}`);

    // camera scroll proof: shove the player to both far corners of the world
    const corners = [[40, s.world.height - 40], [s.world.width - 40, 40]];
    const seen = [];
    for (const [cx, cy] of corners) {
      await D(([x, y]) => window.__melakaDebug.place(x, y), [cx, cy]);
      await sleep(700);
      const c = await D(() => window.__melakaDebug.camera());
      seen.push(`${Math.round(c.x)},${Math.round(c.y)}`);
    }
    log(`  camera scrollX,Y at opposite corners: ${seen.join('  ->  ')}`);

    // back to the authored spawn, then day / dusk / night
    await goTo(id);
    for (const want of ['day', 'dusk', 'night']) {
      for (let i = 0; i < 9 && (await D(() => window.__melakaDebug.timeOfDay())) !== want; i++) {
        await page.keyboard.press('t');
        await sleep(900);
      }
      // The plate crossfade is a 2s tween — screenshot before it settles and
      // you photograph dusk and call it night.
      await sleep(2800);
      const tod = await D(() => window.__melakaDebug.timeOfDay());
      const f = await shot(`${id}-${tod}`);
      log(`  ${tod.padEnd(5)} -> ${path.basename(f)}`);
    }
  }

  // ---- full walk test: every directed edge --------------------------------
  if (argv.includes('--locations-only')) {
    fs.writeFileSync(path.join(OUT, 'report.md'), report.join('\n') + '\n');
    await browser.close();
    return;
  }
  log('\n\n## TRANSITION WALK TEST');
  const edges = [];
  for (const id of ORDER) {
    await goTo(id);
    const ts = await D(() => window.__melakaDebug.transitions());
    ts.forEach((t, i) => edges.push({ from: id, i, ...t }));
  }
  log(`  ${edges.length} directed edges authored`);

  for (const e of edges) {
    if (!(await goTo(e.from))) { log(`  SKIP ${e.from} -> ${e.target}: could not reach source`); continue; }
    // Stand as close to the trigger as the walk mask allows and take the exit
    // for real. A trigger sits ON the frame edge, so its own centre is often
    // half a body outside the walkable area — the engine would slide the
    // player back and the exit would never come into interaction range.
    const tx = e.trigger.x + e.trigger.width / 2;
    const ty = e.trigger.y + e.trigger.height / 2;
    const placed = await D(([x, y]) => {
      const d = window.__melakaDebug;
      const w = d.world();
      for (let r = 0; r <= 120; r += 4) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const px = Math.min(Math.max(x + dx * r, 8), w.width - 8);
          const py = Math.min(Math.max(y + dy * r, 8), w.height - 8);
          if (d.walkable(px, py)) { d.place(px, py); return { x: px, y: py, r }; }
        }
      }
      d.place(x, y);
      return { x, y, r: -1 };
    }, [tx, ty]);
    await sleep(600);
    await D(() => window.__melakaDebug.interact());
    await sleep(2600);
    const s = await state();
    const walkable = await D(() => {
      const p = window.__melakaDebug.player();
      return window.__melakaDebug.walkable(p.x, p.y);
    });
    const ok = s.loc === e.target;
    const name = `edge-${e.from}--to--${e.target}-${e.i}`;
    await shot(name);
    log(`  ${ok ? 'PASS' : 'FAIL'} ${e.from} -[${e.label}]-> ${e.target}: ` +
        `stood at (${placed.x},${placed.y}) [${placed.r}px off trigger centre] ` +
        `arrived in ${s.loc} at (${Math.round(s.player.x)},${Math.round(s.player.y)}) ` +
        `walkable=${walkable} cam=(${Math.round(s.cam.x)},${Math.round(s.cam.y)}) ` +
        `world=${s.world.width}x${s.world.height} -> ${name}.png`);
  }

  log(`\n## CONSOLE ERRORS (${errors.length})`);
  [...new Set(errors)].slice(0, 25).forEach((e) => log('  ' + e.slice(0, 220)));

  fs.writeFileSync(path.join(OUT, 'report.md'), report.join('\n') + '\n');
  await browser.close();
  console.log(`\nreport + screenshots in ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
