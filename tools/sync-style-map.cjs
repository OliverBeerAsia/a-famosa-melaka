#!/usr/bin/env node

/**
 * sync-style-map.cjs
 *
 * Keeps docs/art-bible/shipping-asset-style-map.json in sync with
 * src/data/runtime-asset-manifest.json.  Adds skeleton entries for any
 * shipping asset that does not yet have a style-map record, flags orphans,
 * and reports reference-coverage gaps.
 *
 * Usage:
 *   node tools/sync-style-map.cjs [--report <path>] [--help]
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const runtimeManifestPath = path.join(repoRoot, 'src', 'data', 'runtime-asset-manifest.json');
const styleMapPath = path.join(repoRoot, 'docs', 'art-bible', 'shipping-asset-style-map.json');
const referenceManifestPath = path.join(repoRoot, 'docs', 'art-bible', 'ultima8-reference-manifest.json');

function parseArgs(argv) {
  const args = { help: false, reportPath: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--help' || v === '-h') args.help = true;
    else if (v === '--report') { args.reportPath = argv[i + 1] || null; i++; }
    else if (v.startsWith('--report=')) args.reportPath = v.slice('--report='.length) || null;
  }
  return args;
}

function emptyGradeCard() {
  return {
    silhouetteClarity: null,
    paletteCompliance: null,
    outlineWeight: null,
    ditherQuality: null,
    shadowConsistency: null,
    historicalAccuracy: null,
    densityMatch: null,
    overallGrade: null,
    reviewer: null,
    reviewDate: null,
    notes: '',
  };
}

function ensureEntry(container, id, defaults) {
  if (!container[id]) {
    container[id] = { ...defaults, gradeCard: emptyGradeCard() };
    return true;
  }
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node tools/sync-style-map.cjs [--report <path>] [--help]');
    console.log('Syncs the shipping asset style map with the runtime asset manifest.');
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(runtimeManifestPath, 'utf8'));

  let styleMap;
  if (fs.existsSync(styleMapPath)) {
    styleMap = JSON.parse(fs.readFileSync(styleMapPath, 'utf8'));
  } else {
    styleMap = { version: 1, assets: {} };
  }

  const assets = styleMap.assets;
  if (!assets.characters) assets.characters = {};
  if (!assets.crowd) assets.crowd = {};
  if (!assets.tiles) assets.tiles = {};
  if (!assets.tiles.base) assets.tiles.base = {};
  if (!assets.tiles.isometric) assets.tiles.isometric = {};
  if (!assets.objects) assets.objects = {};
  if (!assets.objects.static) assets.objects.static = {};
  if (!assets.objects.animatedSheets) assets.objects.animatedSheets = {};
  if (!assets.portraits) assets.portraits = {};
  if (!assets.scenes) assets.scenes = {};

  let added = 0;
  const orphans = [];

  // Characters
  (manifest.characters?.named || []).forEach((id) => {
    if (ensureEntry(assets.characters, id, {
      assetClass: 'named-character-sheet',
      runtimePath: `assets/sprites/characters/${id}-sheet.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 1,
    })) added++;
  });

  // Portraits (mirror named characters)
  (manifest.characters?.named || []).forEach((id) => {
    if (ensureEntry(assets.portraits, id, {
      assetClass: 'portrait',
      runtimePath: `assets/sprites/portraits/${id}.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 1,
    })) added++;
  });

  // Crowd
  (manifest.crowd?.sprites || []).forEach((id) => {
    if (ensureEntry(assets.crowd, id, {
      assetClass: 'crowd-silhouette',
      runtimePath: `assets/sprites/crowd/${id}.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 2,
    })) added++;
  });

  // Base tiles
  (manifest.tiles?.base || []).forEach((id) => {
    if (ensureEntry(assets.tiles.base, id, {
      assetClass: 'base-tile',
      runtimePath: `assets/sprites/tiles/${id}.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 2,
    })) added++;
  });

  // Isometric tiles
  (manifest.tiles?.isometric || []).forEach((id) => {
    if (ensureEntry(assets.tiles.isometric, id, {
      assetClass: 'iso-tile',
      runtimePath: `assets/sprites/tiles/iso/${id}-iso.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 2,
    })) added++;
  });

  // Static objects
  (manifest.objects?.static || []).forEach((id) => {
    if (ensureEntry(assets.objects.static, id, {
      assetClass: 'static-object',
      runtimePath: `assets/sprites/objects/${id}.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 2,
    })) added++;
  });

  // Animated sheets
  (manifest.objects?.animatedSheets || []).forEach((id) => {
    if (ensureEntry(assets.objects.animatedSheets, id, {
      assetClass: 'animated-object',
      runtimePath: `assets/sprites/objects/${id}-sheet.png`,
      u8References: [],
      historicalNotes: '',
      status: 'tune',
      wave: 2,
    })) added++;
  });

  // Build the set of expected IDs per section from the manifest
  const expectedSets = {
    characters: new Set(manifest.characters?.named || []),
    crowd: new Set(manifest.crowd?.sprites || []),
    'tiles.base': new Set(manifest.tiles?.base || []),
    'tiles.isometric': new Set(manifest.tiles?.isometric || []),
    'objects.static': new Set(manifest.objects?.static || []),
    'objects.animatedSheets': new Set(manifest.objects?.animatedSheets || []),
    portraits: new Set(manifest.characters?.named || []),
  };

  // Detect orphans
  function checkOrphans(section, sectionKey, expectedSet) {
    Object.keys(section).forEach((id) => {
      if (!expectedSet.has(id)) {
        orphans.push({ section: sectionKey, id });
      }
    });
  }

  checkOrphans(assets.characters, 'characters', expectedSets.characters);
  checkOrphans(assets.crowd, 'crowd', expectedSets.crowd);
  checkOrphans(assets.tiles.base, 'tiles.base', expectedSets['tiles.base']);
  checkOrphans(assets.tiles.isometric, 'tiles.isometric', expectedSets['tiles.isometric']);
  checkOrphans(assets.objects.static, 'objects.static', expectedSets['objects.static']);
  checkOrphans(assets.objects.animatedSheets, 'objects.animatedSheets', expectedSets['objects.animatedSheets']);
  checkOrphans(assets.portraits, 'portraits', expectedSets.portraits);

  // Reference coverage summary
  let refManifest = null;
  if (fs.existsSync(referenceManifestPath)) {
    refManifest = JSON.parse(fs.readFileSync(referenceManifestPath, 'utf8'));
  }
  const validRefIds = refManifest
    ? new Set(Object.keys(refManifest.references || {}))
    : new Set();

  const coverage = { mapped: 0, unmapped: 0, invalidRefs: [] };

  function countCoverage(section, sectionKey) {
    Object.entries(section).forEach(([id, entry]) => {
      const refs = entry.u8References || [];
      if (refs.length > 0) {
        coverage.mapped++;
        refs.forEach((refId) => {
          if (validRefIds.size > 0 && !validRefIds.has(refId)) {
            coverage.invalidRefs.push({ section: sectionKey, id, refId });
          }
        });
      } else {
        coverage.unmapped++;
      }
    });
  }

  countCoverage(assets.characters, 'characters');
  countCoverage(assets.crowd, 'crowd');
  countCoverage(assets.tiles.base, 'tiles.base');
  countCoverage(assets.tiles.isometric, 'tiles.isometric');
  countCoverage(assets.objects.static, 'objects.static');
  countCoverage(assets.objects.animatedSheets, 'objects.animatedSheets');
  countCoverage(assets.portraits, 'portraits');
  countCoverage(assets.scenes, 'scenes');

  // Write back
  fs.writeFileSync(styleMapPath, JSON.stringify(styleMap, null, 2) + '\n', 'utf8');

  // Console output
  const total = coverage.mapped + coverage.unmapped;
  console.log('Ultima VIII style map sync');
  console.log(`  Style map entries: ${total}`);
  console.log(`  Newly added: ${added}`);
  console.log(`  Reference coverage: ${coverage.mapped}/${total} (${total ? Math.round(100 * coverage.mapped / total) : 0}%)`);
  console.log(`  Unmapped assets: ${coverage.unmapped}`);
  if (orphans.length > 0) {
    console.log(`  Orphan entries: ${orphans.length}`);
    orphans.forEach((o) => console.log(`    [warn] ${o.section}/${o.id} is in the style map but not in the runtime manifest`));
  }
  if (coverage.invalidRefs.length > 0) {
    console.log(`  Invalid reference IDs: ${coverage.invalidRefs.length}`);
    coverage.invalidRefs.forEach((r) => console.log(`    [error] ${r.section}/${r.id} -> ${r.refId} not in reference manifest`));
  }

  // Optional report
  if (args.reportPath) {
    const lines = [];
    lines.push('# Style Map Sync Report');
    lines.push('');
    lines.push(`- Total entries: ${total}`);
    lines.push(`- Newly added: ${added}`);
    lines.push(`- Reference coverage: ${coverage.mapped}/${total}`);
    lines.push(`- Unmapped: ${coverage.unmapped}`);
    lines.push(`- Orphans: ${orphans.length}`);
    lines.push(`- Invalid refs: ${coverage.invalidRefs.length}`);
    lines.push('');

    if (orphans.length > 0) {
      lines.push('## Orphan Entries');
      lines.push('');
      lines.push('| Section | ID |');
      lines.push('| --- | --- |');
      orphans.forEach((o) => lines.push(`| ${o.section} | ${o.id} |`));
      lines.push('');
    }

    if (coverage.invalidRefs.length > 0) {
      lines.push('## Invalid Reference IDs');
      lines.push('');
      lines.push('| Section | Asset | Reference ID |');
      lines.push('| --- | --- | --- |');
      coverage.invalidRefs.forEach((r) => lines.push(`| ${r.section} | ${r.id} | ${r.refId} |`));
      lines.push('');
    }

    const reportAbs = path.isAbsolute(args.reportPath) ? args.reportPath : path.join(repoRoot, args.reportPath);
    fs.mkdirSync(path.dirname(reportAbs), { recursive: true });
    fs.writeFileSync(reportAbs, lines.join('\n') + '\n', 'utf8');
    console.log(`Report written to ${path.relative(repoRoot, reportAbs)}`);
  }

  if (coverage.invalidRefs.length > 0) {
    process.exit(1);
  }
}

main();
