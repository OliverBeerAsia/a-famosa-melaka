#!/usr/bin/env node
/**
 * rederive-scenes.cjs
 *
 * Re-derives every installed scene PLATE from its master Canva export using the
 * parameters recorded in tools/canva-sources/MANIFEST.json. This is the
 * reproducible step of the scene pipeline: the master exports are the source of
 * truth, and the shipped 960x540 plate is regenerated from them on demand.
 *
 *   Canva (Magic Media, empty 2:1 iso plaza)  ->  master export (tools/canva-sources)
 *   ->  post-process-scene.cjs (palette-quantize + Bayer dither + pixelate)
 *   ->  assets/scenes/scene-<loc>.png
 *
 * Usage:
 *   node tools/rederive-scenes.cjs           # re-derive all plates
 *   node tools/rederive-scenes.cjs rua-direita waterfront   # subset
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'tools', 'canva-sources', 'MANIFEST.json');
const PROCESSOR = path.join(ROOT, 'tools', 'post-process-scene.cjs');

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`Manifest not found: ${MANIFEST}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const plates = manifest.plates || {};
  const only = process.argv.slice(2);
  const keys = only.length ? only : Object.keys(plates);

  let ok = 0;
  for (const key of keys) {
    const p = plates[key];
    if (!p) { console.warn(`! no manifest entry for "${key}" — skipping`); continue; }
    const raw = path.join(ROOT, p.raw_export);
    const out = path.join(ROOT, p.installed);
    if (!fs.existsSync(raw)) { console.warn(`! missing master export: ${p.raw_export} — skipping ${key}`); continue; }
    const spread = String(p.spread ?? 26);
    const pixelate = String(p.pixelate ?? 3);
    console.log(`\n[rederive] ${key}  (spread ${spread}, pixelate ${pixelate})`);
    execFileSync('node', [
      PROCESSOR, raw, out,
      '--width', '960', '--height', '540',
      '--spread', spread, '--pixelate', pixelate,
    ], { stdio: 'inherit' });
    ok++;
  }
  console.log(`\n[rederive] done — ${ok}/${keys.length} plate(s) re-derived.`);
}

main();
