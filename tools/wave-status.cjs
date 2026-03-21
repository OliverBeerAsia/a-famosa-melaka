#!/usr/bin/env node
/**
 * wave:status — prints a live summary of corrective-wave progress
 * by reading the style map grade cards (source of truth) and wave tracker metadata.
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const TRACKER    = path.join(ROOT, 'docs/art-bible/corrective-waves/wave-tracker.json');
const STYLE_MAP  = path.join(ROOT, 'docs/art-bible/shipping-asset-style-map.json');

const tracker  = JSON.parse(fs.readFileSync(TRACKER, 'utf8'));
const styleMap = JSON.parse(fs.readFileSync(STYLE_MAP, 'utf8'));

// --- Flatten every asset entry out of the nested style-map structure ---
function collectAssets(node) {
  const results = [];
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object' && 'wave' in value) {
      results.push(value);
    } else if (value && typeof value === 'object') {
      results.push(...collectAssets(value));
    }
  }
  return results;
}

const allAssets = collectAssets(styleMap.assets);

// --- Bucket assets by wave and tally live counts ---
const waveBuckets = {};        // waveNum -> { total, graded, keep, tune, replace }
for (const asset of allAssets) {
  const w = asset.wave;
  if (!waveBuckets[w]) waveBuckets[w] = { total: 0, graded: 0, keep: 0, tune: 0, replace: 0 };
  const b = waveBuckets[w];
  b.total++;
  if (asset.gradeCard && asset.gradeCard.overallGrade != null) {
    b.graded++;
  }
  if (asset.status === 'keep')    b.keep++;
  if (asset.status === 'tune')    b.tune++;
  if (asset.status === 'replace') b.replace++;
}

// --- Print report ---
const SEP   = '\u2550'.repeat(47);  // ═
const THIN  = '\u2500'.repeat(47);  // ─

console.log('');
console.log('Wave Status Report');
console.log(SEP);

const waveKeys = Object.keys(tracker.waves).sort();
let grandTotal = 0, grandGraded = 0;

for (const wk of waveKeys) {
  const meta   = tracker.waves[wk];
  const num    = parseInt(wk.replace('wave-', ''), 10);
  const live   = waveBuckets[num] || { total: 0, graded: 0, keep: 0, tune: 0, replace: 0 };
  const status = live.graded === live.total && live.total > 0 ? 'graded' : meta.status;

  grandTotal  += live.total;
  grandGraded += live.graded;

  const blocked = meta.blockedBy ? ` (blocked by ${meta.blockedBy})` : '';
  console.log(`Wave ${num}: ${meta.name}`);
  console.log(`  Status: ${status}${blocked}  |  ${live.graded}/${live.total} graded`);
  if (live.graded > 0) {
    console.log(`  Keep: ${live.keep}  Tune: ${live.tune}  Replace: ${live.replace}`);
  }
  console.log(THIN);
}

const pct = grandTotal > 0 ? Math.round((grandGraded / grandTotal) * 100) : 0;
console.log(SEP);
console.log(`Overall: ${grandGraded}/${grandTotal} graded (${pct}%)`);
console.log('');
