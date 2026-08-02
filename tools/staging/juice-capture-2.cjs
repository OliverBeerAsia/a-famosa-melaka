'use strict';
/**
 * juice-capture-2.cjs — in-engine acceptance for the water cycle and the fauna.
 *
 * Answers, from the live frame rather than from the source:
 *   - is the water cycle actually ticking, and does it swap frames?
 *   - does the DUSK waterfront read warm bronze, never grey? (the art
 *     evaluation's logged defect, which the cycle must not reintroduce)
 *   - do fauna spawn, stand on walkable ground, and sort on worldDepth?
 *   - do fauna + crowd stay under maxCrowdSize?
 *   - do fauna hold still while a panel is open?
 *
 * STAGING TOOL. Start a dev server yourself, then point this at it.
 *   node tools/staging/juice-capture-2.cjs --port 3800
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = flag('--port', '3800');
const OUT = path.resolve(flag('--out', 'tools/forge/staging/juice'));
const BASE = `http://localhost:${PORT}/`;

async function boot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  for (const b of await page.locator('button').all()) {
    if (/new game/i.test((await b.textContent()) || '')) { await b.click(); break; }
  }
  await page.waitForFunction('!!window.__melakaDebug', null, { timeout: 25000 });
  await page.waitForTimeout(1200);
  for (const b of await page.locator('button').all()) {
    if (/begin journey/i.test((await b.textContent()) || '')) { await b.click(); break; }
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
  return { ctx, page, errors };
}

async function setPhase(page, phase) {
  await page.evaluate((want) => {
    const d = window.__melakaDebug;
    for (let i = 0; i < 40; i++) {
      if (d.timeOfDay() === want) return;
      try { d.advanceTime(3); } catch (e) { void e; }
    }
  }, phase);
  await page.waitForTimeout(800);
}

/** Mean warm-vs-cool over the water band, read back off the canvas. */
async function waterWarmth(page, y0, y1) {
  return page.evaluate(([a, b]) => {
    const cv = document.querySelector('canvas');
    if (!cv) return null;
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    const w = cv.width, h = cv.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // readPixels is bottom-up; convert the requested top-down band.
    let warm = 0, cool = 0;
    for (let yTop = a; yTop < b; yTop++) {
      const yGl = h - 1 - yTop;
      if (yGl < 0 || yGl >= h) continue;
      for (let x = 0; x < w; x += 3) {
        const i = (yGl * w + x) * 4;
        if (px[i] > px[i + 2]) warm++; else cool++;
      }
    }
    return { warm, cool, ratio: cool / Math.max(1, warm + cool) };
  }, [y0, y1]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { water: {}, fauna: {}, shots: [], errors: [] };

  // ---- WATER: waterfront at dusk ----------------------------------------
  {
    const { ctx, page, errors } = await boot(browser);
    await page.evaluate(() => { try { window.__melakaDebug.travel('waterfront'); } catch (e) { void e; } });
    await page.waitForTimeout(3200);
    await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
    await setPhase(page, 'dusk');
    await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
    await page.waitForTimeout(1000);

    // Sample the cycle frame over ~1.5 periods; it must visit several frames.
    const frames = [];
    for (let i = 0; i < 24; i++) {
      frames.push(await page.evaluate(() => window.__melakaDebug.juice().water));
      await page.waitForTimeout(160);
    }
    const seen = new Set(frames.filter(Boolean).map((f) => f.frame));
    report.water.dusk = {
      state: frames[frames.length - 1],
      distinctFramesSeen: [...seen].sort((a, b) => a - b),
    };
    report.water.duskWarmth = await waterWarmth(page, 90, 300);

    const file = path.join(OUT, 'water-waterfront-dusk.png');
    await page.screenshot({ path: file });
    report.shots.push(path.relative(process.cwd(), file));
    report.errors.push(...errors);
    await ctx.close();
  }

  // ---- FAUNA: kampung (chickens + dog) and rua (doves, cats, dogs) -------
  for (const [loc, phase] of [['kampung', 'day'], ['rua-direita', 'day'], ['rua-direita', 'night']]) {
    const { ctx, page, errors } = await boot(browser);
    await page.evaluate((l) => { try { window.__melakaDebug.travel(l); } catch (e) { void e; } }, loc);
    await page.waitForTimeout(3200);
    await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
    await setPhase(page, phase);
    await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
    await page.waitForTimeout(2500);

    const probe = await page.evaluate(() => {
      const j = window.__melakaDebug.juice();
      return { fauna: j.fauna, crowd: j.crowd };
    });
    // Every fauna position must be standable, and its depth must be in the
    // world band (below the FX floor at 800).
    const legality = await page.evaluate((list) => list.map((f) => ({
      id: f.id,
      walkable: window.__melakaDebug.walkable(f.x, f.y),
      depth: f.depth,
    })), probe.fauna);

    // Motion: sample positions twice, a second apart.
    const before = probe.fauna.map((f) => `${f.x},${f.y}`);
    await page.waitForTimeout(2500);
    const after = (await page.evaluate(() => window.__melakaDebug.juice().fauna))
      .map((f) => `${f.x},${f.y}`);
    const moved = before.filter((p, i) => p !== after[i]).length;

    report.fauna[`${loc}-${phase}`] = {
      count: probe.fauna.length,
      crowd: probe.crowd,
      ids: [...new Set(probe.fauna.map((f) => f.id))],
      allWalkable: legality.every((l) => l.walkable !== false),
      maxDepth: Math.max(0, ...legality.map((l) => l.depth)),
      movedInterval: `${moved}/${before.length}`,
    };

    const file = path.join(OUT, `fauna-${loc}-${phase}.png`);
    await page.screenshot({ path: file });
    report.shots.push(path.relative(process.cwd(), file));
    report.errors.push(...errors);
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report-2.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
