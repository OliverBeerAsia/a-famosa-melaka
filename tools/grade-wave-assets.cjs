#!/usr/bin/env node
/**
 * grade-wave-assets.cjs
 *
 * Auto-grades shipping assets against Ultima VIII style profiles and
 * populates grade cards in shipping-asset-style-map.json.
 *
 * CLI:  node tools/grade-wave-assets.cjs [--wave 1|2|3] [--help]
 * Default: grade all waves.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLE_MAP_PATH = path.join(ROOT, 'docs/art-bible/shipping-asset-style-map.json');
const SPEC_PATH = path.join(ROOT, 'docs/art-bible/gameplay-asset-spec.json');
const WAVE_TRACKER_PATH = path.join(ROOT, 'docs/art-bible/corrective-waves/wave-tracker.json');

const {
  isCanvasAvailable,
  detectAntiAliasing,
  detectSmoothGradients,
  analyzePortraitClusters,
  checkPaletteCompliance,
  checkShadowDirection,
} = require('./pixel-analysis.cjs');

const { getAllPaletteColors } = require('./ultima8-graphics/palette.cjs');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node tools/grade-wave-assets.cjs [--wave 1|2|3] [--help]

Options:
  --wave <n>   Grade only the specified wave (1, 2, or 3).
               Default: grade all waves.
  --help       Show this help message.
`);
    process.exit(0);
  }

  let waveFilter = null;
  const waveIdx = args.indexOf('--wave');
  if (waveIdx !== -1 && args[waveIdx + 1]) {
    waveFilter = parseInt(args[waveIdx + 1], 10);
    if (![1, 2, 3].includes(waveFilter)) {
      console.error('Error: --wave must be 1, 2, or 3');
      process.exit(1);
    }
  }
  return { waveFilter };
}

// ---------------------------------------------------------------------------
// Build palette set for compliance checking
// ---------------------------------------------------------------------------

function buildPaletteSet() {
  const allColors = getAllPaletteColors();
  const paletteSet = new Set();
  for (const c of allColors) {
    paletteSet.add(c.hex.toUpperCase());
  }
  return paletteSet;
}

// ---------------------------------------------------------------------------
// Flatten style-map assets into a list of { category, subCategory, id, entry }
// ---------------------------------------------------------------------------

function flattenAssets(styleMap) {
  const results = [];
  const assets = styleMap.assets;

  // characters: flat map
  if (assets.characters) {
    for (const [id, entry] of Object.entries(assets.characters)) {
      results.push({ category: 'characters', subCategory: null, id, entry });
    }
  }

  // portraits: flat map
  if (assets.portraits) {
    for (const [id, entry] of Object.entries(assets.portraits)) {
      results.push({ category: 'portraits', subCategory: null, id, entry });
    }
  }

  // crowd: flat map
  if (assets.crowd) {
    for (const [id, entry] of Object.entries(assets.crowd)) {
      results.push({ category: 'crowd', subCategory: null, id, entry });
    }
  }

  // tiles: nested (base, isometric)
  if (assets.tiles) {
    for (const [sub, group] of Object.entries(assets.tiles)) {
      for (const [id, entry] of Object.entries(group)) {
        results.push({ category: 'tiles', subCategory: sub, id, entry });
      }
    }
  }

  // objects: nested (static, animatedSheets)
  if (assets.objects) {
    for (const [sub, group] of Object.entries(assets.objects)) {
      for (const [id, entry] of Object.entries(group)) {
        results.push({ category: 'objects', subCategory: sub, id, entry });
      }
    }
  }

  // scenes: flat map
  if (assets.scenes) {
    for (const [id, entry] of Object.entries(assets.scenes)) {
      results.push({ category: 'scenes', subCategory: null, id, entry });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Look up validation thresholds from the spec's styleProfiles
// ---------------------------------------------------------------------------

function getThresholds(spec, assetClass) {
  const profiles = spec.styleProfiles || {};
  const profile = profiles[assetClass];
  if (profile && profile.validationThresholds) {
    return profile.validationThresholds;
  }
  // Fallback defaults
  return {
    maxAntiAliasingRatio: 0.02,
    maxSmoothGradientRatio: 0.05,
    maxSmoothGradientRun: 4,
  };
}

// ---------------------------------------------------------------------------
// Determine if an asset class is "gameplay" (needs palette check)
// or "cinematic" (portrait/scene -- skip palette check)
// ---------------------------------------------------------------------------

function isGameplayAsset(assetClass) {
  return [
    'named-character-sheet',
    'crowd-silhouette',
    'base-tile',
    'iso-tile',
    'static-object',
    'animated-object',
  ].includes(assetClass);
}

function isPortrait(assetClass) {
  return assetClass === 'portrait';
}

function isScene(assetClass) {
  return assetClass === 'scene-backdrop';
}

// ---------------------------------------------------------------------------
// Grade a single asset
// ---------------------------------------------------------------------------

async function gradeAsset(entry, spec, paletteSet) {
  const assetClass = entry.assetClass;
  const filePath = path.join(ROOT, entry.runtimePath);

  if (!fs.existsSync(filePath)) {
    return null; // skip missing files
  }

  const thresholds = getThresholds(spec, assetClass);
  const maxAARatio = thresholds.maxAntiAliasingRatio || 0.02;
  const maxGradRatio = thresholds.maxSmoothGradientRatio || 0.05;
  const maxGradRun = thresholds.maxSmoothGradientRun || 4;

  // Run analyses
  const aaRatio = await detectAntiAliasing(filePath);
  const gradRatio = await detectSmoothGradients(filePath, maxGradRun);
  const clusters = await analyzePortraitClusters(filePath);
  const shadowScore = await checkShadowDirection(filePath);

  let paletteResult = null;
  if (isGameplayAsset(assetClass)) {
    paletteResult = await checkPaletteCompliance(filePath, paletteSet);
  }

  const notes = [];

  // --- Grade each dimension ---

  // paletteCompliance: gameplay only
  let paletteCompliance = null;
  if (isGameplayAsset(assetClass) && paletteResult) {
    const { nonPalettePixels, totalOpaquePixels } = paletteResult;
    if (totalOpaquePixels === 0) {
      paletteCompliance = 'pass';
    } else {
      const ratio = nonPalettePixels / totalOpaquePixels;
      if (nonPalettePixels === 0) {
        paletteCompliance = 'pass';
      } else if (ratio < 0.05) {
        paletteCompliance = 'partial';
        notes.push(`palette: ${(ratio * 100).toFixed(1)}% off-palette pixels`);
      } else {
        paletteCompliance = 'fail';
        notes.push(`palette: ${(ratio * 100).toFixed(1)}% off-palette pixels`);
      }
    }
  }

  // outlineWeight: based on anti-aliasing ratio
  let outlineWeight = null;
  if (aaRatio !== null) {
    if (aaRatio <= 0.01) {
      outlineWeight = 'pass';
    } else if (aaRatio <= maxAARatio) {
      outlineWeight = 'partial';
      notes.push(`outline: AA ratio ${aaRatio.toFixed(3)}`);
    } else {
      outlineWeight = 'fail';
      notes.push(`outline: AA ratio ${aaRatio.toFixed(3)} exceeds ${maxAARatio}`);
    }
  }

  // ditherQuality: smooth gradient ratio
  let ditherQuality = null;
  if (gradRatio !== null) {
    if (gradRatio < 0.01) {
      ditherQuality = 'pass';
    } else if (gradRatio < maxGradRatio) {
      ditherQuality = 'partial';
      notes.push(`dither: gradient ratio ${gradRatio.toFixed(3)}`);
    } else {
      ditherQuality = 'fail';
      notes.push(`dither: gradient ratio ${gradRatio.toFixed(3)} exceeds ${maxGradRatio}`);
    }
  }

  // shadowConsistency: SE score
  let shadowConsistency = null;
  if (shadowScore !== null) {
    if (shadowScore > 0.6) {
      shadowConsistency = 'pass';
    } else if (shadowScore > 0.3) {
      shadowConsistency = 'partial';
      notes.push(`shadow: SE score ${shadowScore.toFixed(2)}`);
    } else {
      shadowConsistency = 'fail';
      notes.push(`shadow: SE score ${shadowScore.toFixed(2)}`);
    }
  }

  // silhouetteClarity
  let silhouetteClarity = null;
  if (isPortrait(assetClass)) {
    // For portraits, check cluster count is in range
    if (clusters !== null) {
      const minClusters = thresholds.minColorClusters || 4;
      const maxClusters = thresholds.maxColorClusters || 256;
      if (clusters >= minClusters && clusters <= maxClusters) {
        silhouetteClarity = 'pass';
      } else if (clusters < minClusters) {
        silhouetteClarity = 'fail';
        notes.push(`silhouette: only ${clusters} color clusters (min ${minClusters})`);
      } else {
        silhouetteClarity = 'partial';
        notes.push(`silhouette: ${clusters} color clusters (max ${maxClusters})`);
      }
    }
  } else if (!isScene(assetClass)) {
    // For gameplay assets, low anti-aliasing = good silhouette
    if (aaRatio !== null) {
      if (aaRatio <= 0.01) {
        silhouetteClarity = 'pass';
      } else if (aaRatio <= maxAARatio) {
        silhouetteClarity = 'partial';
      } else {
        silhouetteClarity = 'fail';
      }
    }
  }

  // historicalAccuracy: always null (requires human review)
  const historicalAccuracy = null;

  // densityMatch: null for individual assets
  const densityMatch = null;

  // --- Compute overallGrade ---
  const autoFields = [
    paletteCompliance,
    outlineWeight,
    ditherQuality,
    shadowConsistency,
    silhouetteClarity,
  ].filter((v) => v !== null);

  let overallGrade = null;
  if (autoFields.length > 0) {
    if (autoFields.some((f) => f === 'fail')) {
      overallGrade = 'fail';
    } else if (autoFields.some((f) => f === 'partial')) {
      overallGrade = 'partial';
    } else {
      overallGrade = 'pass';
    }
  }

  // --- Verdict ---
  let verdict = null;
  if (overallGrade === 'pass') verdict = 'keep';
  else if (overallGrade === 'partial') verdict = 'tune';
  else if (overallGrade === 'fail') verdict = 'replace';

  const today = new Date().toISOString().split('T')[0];

  return {
    gradeCard: {
      silhouetteClarity,
      paletteCompliance,
      outlineWeight,
      ditherQuality,
      shadowConsistency,
      historicalAccuracy,
      densityMatch,
      overallGrade,
      reviewer: 'auto-grader-v1',
      reviewDate: today,
      notes: notes.join('; '),
    },
    status: verdict,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { waveFilter } = parseArgs();

  if (!isCanvasAvailable()) {
    console.error('Warning: canvas module not available. Pixel analysis will return null values.');
    console.error('Install with: npm install canvas');
  }

  // Load data files
  const styleMap = JSON.parse(fs.readFileSync(STYLE_MAP_PATH, 'utf-8'));
  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8'));
  const waveTracker = JSON.parse(fs.readFileSync(WAVE_TRACKER_PATH, 'utf-8'));

  const paletteSet = buildPaletteSet();
  const allAssets = flattenAssets(styleMap);

  // Filter by wave
  const wavesToGrade = waveFilter ? [waveFilter] : [1, 2, 3];

  const summaryByWave = {};

  for (const waveNum of wavesToGrade) {
    const waveAssets = allAssets.filter((a) => a.entry.wave === waveNum);

    let graded = 0;
    let keep = 0;
    let tune = 0;
    let replace = 0;
    let skipped = 0;

    for (const asset of waveAssets) {
      const result = await gradeAsset(asset.entry, spec, paletteSet);

      if (!result) {
        skipped++;
        continue;
      }

      // Update the entry's gradeCard in the style map object
      asset.entry.gradeCard = result.gradeCard;
      asset.entry.status = result.status;

      graded++;
      if (result.status === 'keep') keep++;
      else if (result.status === 'tune') tune++;
      else if (result.status === 'replace') replace++;
    }

    // Update wave tracker
    const waveKey = `wave-${waveNum}`;
    if (waveTracker.waves[waveKey]) {
      waveTracker.waves[waveKey].graded = graded;
      waveTracker.waves[waveKey].keep = keep;
      waveTracker.waves[waveKey].tune = tune;
      waveTracker.waves[waveKey].replace = replace;
      if (graded > 0 && graded + skipped >= waveAssets.length) {
        waveTracker.waves[waveKey].status = 'graded';
      }
    }

    summaryByWave[waveNum] = {
      total: waveAssets.length,
      graded,
      skipped,
      keep,
      tune,
      replace,
    };
  }

  // Update tracker date
  waveTracker.lastUpdated = new Date().toISOString().split('T')[0];

  // Write back both JSON files
  fs.writeFileSync(STYLE_MAP_PATH, JSON.stringify(styleMap, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(WAVE_TRACKER_PATH, JSON.stringify(waveTracker, null, 2) + '\n', 'utf-8');

  // Print summary
  console.log('\n=== Wave Asset Grading Summary ===\n');
  for (const [waveNum, summary] of Object.entries(summaryByWave)) {
    console.log(`Wave ${waveNum}:`);
    console.log(`  Total assets:  ${summary.total}`);
    console.log(`  Graded:        ${summary.graded}`);
    console.log(`  Skipped:       ${summary.skipped} (file not found)`);
    console.log(`  Keep:          ${summary.keep}`);
    console.log(`  Tune:          ${summary.tune}`);
    console.log(`  Replace:       ${summary.replace}`);
    console.log('');
  }

  console.log('Updated:');
  console.log(`  ${STYLE_MAP_PATH}`);
  console.log(`  ${WAVE_TRACKER_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
