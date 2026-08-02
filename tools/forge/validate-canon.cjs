#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — CANON GATE
 * =========================
 * Runs in `pretest` / `prebuild` alongside validate-location-data.cjs.
 *
 * Three gates:
 *
 *  (a) CANON MEMBERSHIP
 *      Every migrated shipping PNG uses only colours the canon allows.
 *      - day plates      ⊆ the 50-colour canon
 *      - dawn/dusk/night ⊆ the canon's deterministic LUT image for that hour,
 *                          plus the baked light-pool ramp. A relit plate is not
 *                          IN the canon — it is in the canon RELIT, and that
 *                          set is derived, not authored.
 *      - crowd + character sprites ⊆ the canon
 *      Anything not yet migrated is named in LEGACY_ALLOWLIST below. That list
 *      is meant to SHRINK: every later stage should delete entries from it.
 *
 *  (b) RELIGHT PROVENANCE / DETERMINISM
 *      relight-plates.cjs is re-run into a scratch directory and every plate is
 *      compared byte-for-byte with what is checked in. If they differ, the
 *      shipping plates were hand-edited or the tool drifted — either way the
 *      "one authored day master, everything else derived" contract is broken.
 *      Skipped with --fast (it re-renders 20 plates; ~10s).
 *
 *  (c) ZERO ANTI-ALIASING
 *      Every pixel of a migrated sprite is alpha 0 or alpha 255. Partial alpha
 *      on a 16x32 sprite is a soft edge, and a soft edge is the single most
 *      reliable way to make pixel art look like a scaled-down photograph.
 *
 * CLI
 *   node tools/forge/validate-canon.cjs            all gates
 *   node tools/forge/validate-canon.cjs --fast     skip the determinism re-render
 *   node tools/forge/validate-canon.cjs --verbose  list every offending colour
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('./palette.cjs');
const RP = require('./relight-plates.cjs');

const REPO = path.resolve(__dirname, '../..');
const SCENES = path.join(REPO, 'assets', 'scenes');

/**
 * Assets still on the legacy 184/48-colour palettes.
 *
 * SHRINK THIS LIST. Each entry is a promise that a later stage migrates that
 * set; an entry that is still here when its stage lands is a regression, not a
 * exemption. Nothing may be ADDED to it without a matching stage that removes it.
 */
const LEGACY_ALLOWLIST = [
  { glob: 'assets/sprites/portraits/', stage: 6, why: 'VGA portraits — Stage 6 rebuilds all 14' },
  { glob: 'assets/sprites/objects/', stage: 3, why: 'props — Stage 3 plate compositor re-emits these from the Forge kits' },
  { glob: 'assets/sprites/tiles/', stage: 3, why: 'iso tiles — not the shipping path; Stage 3 decides their fate' },
  { glob: 'assets/sprites/effects/', stage: 5, why: 'particles — Stage 5' },
];

function isAllowed(rel) {
  return LEGACY_ALLOWLIST.some((e) => rel === e.glob || rel.startsWith(e.glob));
}

// ---------------------------------------------------------------------------
function packed(r, g, b) { return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }

const CANON_SET = new Set(P.CANON.map((c) => packed(c.r, c.g, c.b)));

let _canvas = null;
function canvasLib() {
  if (!_canvas) _canvas = require('canvas');
  return _canvas;
}

async function readPixels(file) {
  const { createCanvas, loadImage } = canvasLib();
  const img = await loadImage(file);
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

/** { offenders: Map<packed,count>, partialAlpha: n, total: n } */
async function inspect(file, allowedSet) {
  const id = await readPixels(file);
  const d = id.data;
  const offenders = new Map();
  let partialAlpha = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a !== 0 && a !== 255) partialAlpha++;
    if (a === 0) continue;
    const k = packed(d[i], d[i + 1], d[i + 2]);
    if (!allowedSet.has(k)) offenders.set(k, (offenders.get(k) || 0) + 1);
  }
  return { offenders, partialAlpha, total: d.length / 4 };
}

function listPngs(dir, match) {
  const abs = path.join(REPO, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => (match ? match.test(f) : f.endsWith('.png')))
    .sort().map((f) => path.join(abs, f));
}

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }

// ---------------------------------------------------------------------------
async function gateMembership(problems, opts) {
  const locations = RP.discoverLocations();
  const targets = [];

  locations.forEach((loc) => {
    targets.push({ file: path.join(SCENES, `${loc.stem}.png`), allowed: RP.derivedPalette('day'), what: `day plate (${loc.id})` });
    Object.entries(loc.variants).forEach(([tod, key]) => {
      targets.push({ file: path.join(SCENES, `${key}.png`), allowed: RP.derivedPalette(tod), what: `${tod} plate (${loc.id})` });
    });
    // Foreground occluders are cut from the plate and relit through the same
    // LUT, so they answer to the same palette at the same hour. If they ever
    // drift the player sees a differently-lit ghost of the wall in front of them.
    loc.overlays.forEach((o) => {
      targets.push({
        file: path.join(RP.OVERLAYS_DIR, `${o.key}.png`),
        allowed: RP.derivedPalette('day'), what: `day overlay (${loc.id})`,
      });
      Object.keys(loc.variants).forEach((tod) => {
        targets.push({
          file: path.join(RP.OVERLAYS_DIR, `${o.key}-${tod}.png`),
          allowed: RP.derivedPalette(tod), what: `${tod} overlay (${loc.id})`,
        });
      });
    });
  });

  // The title and loading panoramas (tools/forge/title-screen.cjs). They are
  // composed from the kits like any plate and then relit through the LUT, so
  // they answer to the same derived palette as a plate at that hour — NOT to
  // the raw canon. Both came off LEGACY_ALLOWLIST in v0.12 and this is what
  // replaced the exemption; deleting the entry without adding the check would
  // have retired the exemption and the coverage in the same commit.
  [
    { file: path.join(SCENES, 'opening-screen.png'), tod: 'dusk', what: 'title screen' },
    { file: path.join(SCENES, 'scene-loading-ribeira.png'), tod: 'night', what: 'loading screen' },
  ].forEach((s) => targets.push({ file: s.file, allowed: RP.derivedPalette(s.tod), what: s.what }));

  [...listPngs('assets/sprites/crowd'), ...listPngs('assets/sprites/characters', /-sheet\.png$/)]
    .forEach((f) => targets.push({ file: f, allowed: CANON_SET, what: 'sprite' }));

  // UI chrome (tools/forge/ui.cjs) and, since v0.12, the 27 inventory item
  // icons (tools/forge/item-icons.cjs). listPngs is non-recursive, so `items/`
  // has to be named explicitly — dropping it off LEGACY_ALLOWLIST without
  // adding it here would have retired the exemption and the coverage together,
  // which is the one way an allowlist entry can be deleted dishonestly.
  listPngs('assets/sprites/ui')
    .forEach((f) => targets.push({ file: f, allowed: CANON_SET, what: 'UI chrome' }));
  listPngs('assets/sprites/ui/items')
    .forEach((f) => targets.push({ file: f, allowed: CANON_SET, what: 'item icon' }));

  for (const t of targets) {
    if (!fs.existsSync(t.file)) { problems.push(`missing: ${rel(t.file)}`); continue; }
    if (isAllowed(rel(t.file))) continue;
    // eslint-disable-next-line no-await-in-loop
    const { offenders, partialAlpha } = await inspect(t.file, t.allowed);
    if (offenders.size) {
      const worst = [...offenders.entries()].sort((a, b) => b[1] - a[1]);
      const shown = (opts.verbose ? worst : worst.slice(0, 4))
        .map(([k, n]) => `${P.rgbToHex((k >> 16) & 255, (k >> 8) & 255, k & 255)} x${n}`).join(' ');
      problems.push(
        `${rel(t.file)}: ${offenders.size} off-canon colour(s) in ${t.what} — ${shown}` +
        (opts.verbose || worst.length <= 4 ? '' : ` (+${worst.length - 4} more)`)
      );
    }
    // (c) zero anti-aliasing, on everything migrated
    if (partialAlpha) {
      problems.push(`${rel(t.file)}: ${partialAlpha} pixel(s) with partial alpha — pixel art has no soft edges`);
    }
  }
  return targets.length;
}

// ---------------------------------------------------------------------------
async function gateDeterminism(problems) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-canon-'));
  try {
    await RP.run({ outDir: tmp, writeDay: true });
    const locations = RP.discoverLocations();
    let checked = 0;
    for (const loc of locations) {
      const names = [`${loc.stem}.png`, ...Object.values(loc.variants).map((k) => `${k}.png`)];
      loc.overlays.forEach((o) => {
        names.push(path.join('overlays', `${o.key}.png`));
        Object.keys(loc.variants).forEach((tod) => names.push(path.join('overlays', `${o.key}-${tod}.png`)));
      });
      for (const n of names) {
        const a = path.join(SCENES, n);
        const b = path.join(tmp, n);
        if (!fs.existsSync(a) || !fs.existsSync(b)) { problems.push(`determinism: cannot compare ${n}`); continue; }
        if (!fs.readFileSync(a).equals(fs.readFileSync(b))) {
          problems.push(
            `determinism: assets/scenes/${n} differs from a fresh relight — the plate was hand-edited, ` +
            'or relight-plates.cjs changed without regenerating. Run `npm run forge:relight`.'
          );
        }
        checked++;
      }
    }
    return checked;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
async function gateRuntimeSync(problems) {
  const file = path.join(REPO, 'src', 'data', 'relight-runtime.json');
  if (!fs.existsSync(file)) {
    problems.push('missing src/data/relight-runtime.json — run `npm run forge:relight`');
    return;
  }
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fresh = RP.buildRuntime();
  if (JSON.stringify(onDisk.times) !== JSON.stringify(fresh.times)) {
    problems.push(
      'src/data/relight-runtime.json is stale — the character tints no longer match the relight LUTs ' +
      'that baked the plates (this is exactly how the double-grade comes back). Run `npm run forge:relight`.'
    );
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const opts = { fast: argv.includes('--fast'), verbose: argv.includes('--verbose') };
  const problems = [];

  const palette = P.check();
  palette.problems.forEach((p) => problems.push(`palette canon: ${p}`));

  const n = await gateMembership(problems, opts);
  await gateRuntimeSync(problems);
  let det = 0;
  if (!opts.fast) det = await gateDeterminism(problems);

  console.log(`Forge canon gate — ${P.CANON.length} colours, ${n} migrated asset(s) checked` +
    (opts.fast ? ', determinism skipped (--fast)' : `, ${det} plate(s) byte-compared`));
  console.log(`  legacy allowlist: ${LEGACY_ALLOWLIST.length} entr${LEGACY_ALLOWLIST.length === 1 ? 'y' : 'ies'} ` +
    `(stages ${[...new Set(LEGACY_ALLOWLIST.map((e) => e.stage))].sort().join(', ')})`);

  if (problems.length) {
    console.error('\nFAILED:');
    problems.forEach((p) => console.error('  ! ' + p));
    process.exit(1);
  }
  console.log('  all canon gates pass');
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { LEGACY_ALLOWLIST, isAllowed, inspect };
