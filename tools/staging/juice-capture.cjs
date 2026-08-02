'use strict';
/**
 * juice-capture.cjs — in-engine acceptance capture for the v0.12 juice pass.
 *
 * Drives an already-running dev server with Playwright and answers the
 * questions the game-feel spec's §6.1 asks FROM THE ACTUAL FRAME rather than
 * from the source:
 *
 *   - does MelakaPostFX attach, and does `?fx=off` really fall back?
 *   - do two same-type animated props ever share an animation frame index?
 *     (benchmark item 9 — the defect this pass exists to kill)
 *   - are the practicals desynced at night?
 *   - does the surface-response pool stay inside its 24-object budget?
 *
 * STAGING TOOL. Not wired into any npm script: start a dev server yourself,
 * then run this against it.
 *
 *   node tools/staging/juice-capture.cjs --port 3800
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const PORT = flag('--port', '3800');
const OUT = path.resolve(flag('--out', 'tools/forge/staging/juice'));
const BASE = `http://localhost:${PORT}/`;

/** location, target hour, label. */
const SHOTS = [
  ['rua-direita', 13, 'day'],
  ['rua-direita', 23, 'night'],
  ['waterfront', 13, 'day'],
  ['waterfront', 23, 'night'],
];

const HOOK = '__melakaDebug';

async function boot(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });

  // The title screen sits in front of the world; the debug hook only exists
  // once GameScene.create() has run.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForFunction(`!!window.${HOOK}`, null, { timeout: 15000 });
      return { ctx, page, errors };
    } catch {
      const buttons = await page.locator('button, [role="button"]').all();
      for (const b of buttons) {
        const label = ((await b.textContent()) || '').trim();
        if (/begin|start|new|continue|play|enter/i.test(label)) {
          await b.click().catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForFunction(`!!window.${HOOK}`, null, { timeout: 20000 });
  await dismissOverlays(page);
  return { ctx, page, errors };
}

/**
 * Clear the onboarding card. The hook appears the moment GameScene builds, but
 * the controls modal is still over the frame — a screenshot taken then shows a
 * parchment panel, not the scene, which is exactly the kind of "verified"
 * capture that verifies nothing.
 */
async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    const buttons = await page.locator('button, [role="button"]').all();
    let clicked = false;
    for (const b of buttons) {
      const label = ((await b.textContent()) || '').trim();
      if (/begin journey|got it|close|continue|dismiss|ok/i.test(label)) {
        await b.click().catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
    await page.waitForTimeout(700);
  }
  // NO blind Escape here. Escape is the pause toggle: on a frame that has
  // nothing to dismiss it OPENS the pause menu, and the capture then
  // photographs the settings panel instead of the scene. (It did.)
  if (await page.getByText('PAUSED', { exact: false }).count()) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
}

/** Walk the clock to `hour` using the DEV hook's +/-hours granularity. */
async function setHour(page, hour) {
  await page.evaluate((target) => {
    const d = window.__melakaDebug;
    for (let i = 0; i < 30; i++) {
      const phase = d.timeOfDay();
      const wantNight = target >= 20 || target < 5;
      const wantDay = target >= 10 && target < 16;
      if (wantNight && phase === 'night') return;
      if (wantDay && phase === 'day') return;
      // A throw from an unrelated system's hour handler must not abort the
      // capture: the clock has still moved, so keep walking it.
      try { d.advanceTime(3); } catch (e) { void e; }
    }
  }, hour);
  await page.waitForTimeout(600);
}

/**
 * Sample the juice probe N times and score the benchmark-9 gate.
 *
 * THE METRIC, and why the obvious one is wrong. "Do any two instances share a
 * frame index?" sounds right and is useless: ten lanterns cycling three
 * palette states MUST share by the pigeonhole principle, so that metric reads
 * 100 % even for a perfectly spread set. What benchmark 9 actually forbids is
 * LOCKSTEP, so the number reported is `maxShare` — the largest fraction of
 * instances sitting on one frame at the same moment.
 *
 *   lockstep (the defect)   maxShare = 1.00
 *   perfectly spread        maxShare = ceil(instances / frames) / instances
 *
 * `lockstepRate` counts the samples where EVERY instance agreed, which is the
 * pass/fail line: it must be 0.
 */
async function samplePhases(page, samples = 24, gapMs = 125) {
  const rows = [];
  for (let i = 0; i < samples; i++) {
    rows.push(await page.evaluate(() => window.__melakaDebug.juice()));
    await page.waitForTimeout(gapMs);
  }
  const score = {};
  for (const key of ['propPhases', 'flickerPhases']) {
    score[key] = {};
    const types = new Set();
    rows.forEach((r) => Object.keys(r[key] || {}).forEach((t) => types.add(t)));
    for (const type of types) {
      let lockstep = 0;
      let shareSum = 0;
      let shareMax = 0;
      let counted = 0;
      let n = 0;
      for (const r of rows) {
        const frames = (r[key] || {})[type] || [];
        if (frames.length < 2) continue;
        n = frames.length;
        counted++;
        const tally = new Map();
        frames.forEach((f) => tally.set(f, (tally.get(f) || 0) + 1));
        const biggest = Math.max(...tally.values());
        const share = biggest / frames.length;
        shareSum += share;
        if (share > shareMax) shareMax = share;
        if (biggest === frames.length) lockstep++;
      }
      if (counted) {
        score[key][type] = {
          instances: n,
          samples: counted,
          lockstepRate: +(lockstep / counted).toFixed(3),
          meanMaxShare: +(shareSum / counted).toFixed(3),
          worstMaxShare: +shareMax.toFixed(3),
        };
      }
    }
  }
  return { score, last: rows[rows.length - 1] };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { fxOn: {}, fxOff: {}, shots: [], errors: [] };

  // ---- FX ON -------------------------------------------------------------
  // One fresh page per shot. A scene restart plus a clock walk is exactly the
  // sequence most likely to trip over an unrelated system mid-refactor, and a
  // capture that dies on shot three tells you nothing about shot four.
  {
    for (const [location, hour, label] of SHOTS) {
      const { ctx, page, errors } = await boot(browser, '');
      // Pin the tier: the dynamic governor downgrades on a slow frame, and a
      // headless capture is ALWAYS a slow frame. Without this the run measures
      // `low` (grain off, four animated props instead of fifteen) and reports
      // it as the shipping look.
      await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
      await page.waitForTimeout(400);
      await page.evaluate((loc) => {
        try { window.__melakaDebug.travel(loc); } catch (e) { void e; }
      }, location);
      await page.waitForTimeout(3000);
      await dismissOverlays(page);
      await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
      await setHour(page, hour);
      await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
      await dismissOverlays(page);
      await page.waitForTimeout(900);
      const file = path.join(OUT, `fxon-${location}-${label}.png`);
      await page.screenshot({ path: file });
      report.shots.push(path.relative(process.cwd(), file));

      const probe = await samplePhases(page, label === 'night' ? 24 : 16);
      report.fxOn[`${location}-${label}`] = {
        lens: {
          postFX: probe.last.postFX,
          lut: probe.last.lut,
          vignette: probe.last.vignette,
          grain: probe.last.grain,
          haze: probe.last.haze,
        },
        surfacePool: probe.last.surfacePool,
        benchmark9: probe.score,
        actualLocation: await page.evaluate(() => window.__melakaDebug.location()),
        actualPhase: await page.evaluate(() => window.__melakaDebug.timeOfDay()),
      };
      report.errors.push(...errors);
      await ctx.close();
    }
  }

  // ---- FX OFF (the canvas-parity A/B) ------------------------------------
  {
    const { ctx, page, errors } = await boot(browser, '?fx=off');
    await dismissOverlays(page);
    // Same tier as the FX-ON leg, or the A/B compares two different profiles.
    await page.evaluate(() => window.__melakaDebug.setQuality('high', false));
    await page.waitForTimeout(1800);
    const file = path.join(OUT, 'fxoff-rua-direita-day.png');
    await page.screenshot({ path: file });
    report.shots.push(path.relative(process.cwd(), file));
    report.fxOff.lens = await page.evaluate(() => {
      const j = window.__melakaDebug.juice();
      return { postFX: j.postFX, lut: j.lut, vignette: j.vignette };
    });
    report.errors.push(...errors);
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
