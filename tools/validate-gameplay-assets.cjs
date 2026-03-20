#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { getAllPaletteColors } = require('./ultima8-graphics/palette.cjs');

const repoRoot = path.join(__dirname, '..');
const specPath = path.join(repoRoot, 'docs', 'art-bible', 'gameplay-asset-spec.json');
const runtimeManifestPath = path.join(repoRoot, 'src', 'data', 'runtime-asset-manifest.json');
const environmentDataPath = path.join(repoRoot, 'src', 'data', 'environment-objects.json');

function parseArgs(argv) {
  const args = {
    strict: false,
    help: false,
    reportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--strict') {
      args.strict = true;
    } else if (value === '--help' || value === '-h') {
      args.help = true;
    } else if (value === '--report') {
      args.reportPath = argv[index + 1] || null;
      index += 1;
    } else if (value.startsWith('--report=')) {
      args.reportPath = value.slice('--report='.length) || null;
    }
  }

  return args;
}

function normalizeRelPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function walkPngs(rootDir) {
  const files = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    fs.readdirSync(currentDir, { withFileTypes: true }).forEach((entry) => {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(nextPath);
        return;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        files.push(nextPath);
      }
    });
  }

  walk(rootDir);
  return files;
}

async function inspectPng(filePath) {
  const image = await loadImage(filePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    imageData: ctx.getImageData(0, 0, image.width, image.height),
  };
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

function addFinding(findings, severity, file, issue, hint, assetClass) {
  findings.push({
    severity,
    file,
    issue,
    hint,
    assetClass,
  });
}

function getSpecLists(spec) {
  const gameplay = spec.assetClasses?.gameplay || {};
  const cinematic = spec.assetClasses?.cinematic || {};
  const concept = spec.assetClasses?.concept || {};

  return {
    gameplayDirs: gameplay.directories || spec.allowedDirectories?.gameplay || [],
    cinematicDirs: cinematic.directories || spec.allowedDirectories?.cinematic || [],
    conceptDirs: concept.directories || spec.allowedDirectories?.concept || [],
    gameplayRules: gameplay.rules || spec.gameplayRules || {},
    cinematicRules: cinematic.rules || spec.cinematicRules || {},
    gameplayPatterns: gameplay.filenamePatterns || {},
    cinematicPatterns: cinematic.filenamePatterns || {},
    namedCharacterSheet: spec.modules?.namedCharacterSheet?.[0] || null,
    crowdSilhouettes: spec.modules?.crowdSilhouette || [],
    sceneBackdrops: spec.modules?.sceneBackdrop || [],
  };
}

function classifyAsset(relPath, gameplayDirs, cinematicDirs, conceptDirs) {
  const normalized = relPath;
  const categories = [
    ...gameplayDirs.map((dir) => ({ name: 'gameplay', dir })),
    ...cinematicDirs.map((dir) => ({ name: 'cinematic', dir })),
    ...conceptDirs.map((dir) => ({ name: 'concept', dir })),
  ];

  for (const category of categories) {
    if (normalized === category.dir || normalized.startsWith(`${category.dir}/`)) {
      return category.name;
    }
  }

  return 'unclassified';
}

function matchesAnyPattern(fileName, patterns) {
  return Object.values(patterns || {})
    .filter(Boolean)
    .some((pattern) => new RegExp(pattern).test(fileName));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function analyzeGameplayPixels(imageData, paletteSet, allowPartialAlpha) {
  const { data } = imageData;
  let nonPalettePixels = 0;
  let partialAlphaPixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) continue;

    if (alpha !== 255) {
      partialAlphaPixels += 1;
      if (allowPartialAlpha) continue;
    }

    const hex = rgbToHex(data[index], data[index + 1], data[index + 2]);
    if (!paletteSet.has(hex)) {
      nonPalettePixels += 1;
    }
  }

  return { nonPalettePixels, partialAlphaPixels };
}

function fileExists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function validateRuntimeManifest(manifest, spec, findings) {
  const namedSheet = spec.modules?.namedCharacterSheet?.[0];
  const manifestSheet = manifest.characters?.sheet || {};

  if (
    namedSheet
    && (
      namedSheet.frameWidth !== manifestSheet.frameWidth
      || namedSheet.frameHeight !== manifestSheet.frameHeight
      || namedSheet.columns !== manifestSheet.columns
      || namedSheet.rows !== manifestSheet.rows
    )
  ) {
    addFinding(
      findings,
      'error',
      normalizeRelPath(runtimeManifestPath),
      'runtime manifest character sheet contract does not match the art spec',
      'Keep the live runtime manifest and gameplay-asset-spec.json in sync.',
      'runtime'
    );
  }

  (manifest.characters?.named || []).forEach((id) => {
    const relPath = `assets/sprites/characters/${id}-sheet.png`;
    if (!fileExists(relPath)) {
      addFinding(
        findings,
        'error',
        relPath,
        'runtime character sheet is missing',
        'Generate the shipping sheet before promotion.',
        'runtime'
      );
    }
  });

  (manifest.crowd?.sprites || []).forEach((id) => {
    const relPath = `assets/sprites/crowd/${id}.png`;
    if (!fileExists(relPath)) {
      addFinding(
        findings,
        'error',
        relPath,
        'runtime crowd sprite is missing',
        'Generate the crowd silhouette before promotion.',
        'runtime'
      );
    }
  });

  (manifest.tiles?.base || []).forEach((id) => {
    const relPath = `assets/sprites/tiles/${id}.png`;
    if (!fileExists(relPath)) {
      addFinding(findings, 'error', relPath, 'runtime tile is missing', 'Restore the tile or remove it from the runtime manifest.', 'runtime');
    }
  });

  (manifest.tiles?.isometric || []).forEach((id) => {
    const relPath = `assets/sprites/tiles/iso/${id}-iso.png`;
    if (!fileExists(relPath)) {
      addFinding(findings, 'error', relPath, 'runtime isometric tile is missing', 'Regenerate the iso tile before promotion.', 'runtime');
    }
  });

  (manifest.objects?.static || []).forEach((id) => {
    const relPath = `assets/sprites/objects/${id}.png`;
    if (!fileExists(relPath)) {
      addFinding(findings, 'error', relPath, 'runtime object sprite is missing', 'Restore the object sprite or remove it from the runtime manifest.', 'runtime');
    }
  });

  (manifest.maps?.base || []).forEach((id) => {
    const relPath = `assets/maps/${id}.json`;
    if (!fileExists(relPath)) {
      addFinding(findings, 'error', relPath, 'runtime map JSON is missing', 'Restore the map or remove it from the runtime manifest.', 'runtime');
    }
  });

  (manifest.maps?.isometric || []).forEach((id) => {
    const relPath = `assets/maps/${id}-iso.json`;
    if (!fileExists(relPath)) {
      addFinding(findings, 'error', relPath, 'runtime isometric map JSON is missing', 'Restore the map or remove it from the runtime manifest.', 'runtime');
    }
  });
}

function validateMapParity(manifest, findings) {
  const validObjectNames = new Set(manifest.objects?.static || []);
  const validLayerNames = new Set(['Objects', 'Props', 'Overhang', 'Canopy', 'Highlights']);

  (manifest.maps?.isometric || []).forEach((mapId) => {
    const relPath = `assets/maps/${mapId}-iso.json`;
    const absolutePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absolutePath)) return;

    const map = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    (map.layers || [])
      .filter((layer) => layer.type === 'objectgroup')
      .forEach((layer) => {
        if (!validLayerNames.has(layer.name)) {
          addFinding(
            findings,
            'warn',
            relPath,
            `object layer "${layer.name}" is outside the supported runtime layer contract`,
            'Use Objects, Props, Overhang, Canopy, or Highlights for live rendering.',
            'runtime'
          );
        }

        (layer.objects || []).forEach((objectDef) => {
          if (!objectDef.name) return;
          if (!validObjectNames.has(objectDef.name)) {
            addFinding(
              findings,
              'error',
              relPath,
              `map object "${objectDef.name}" has no runtime-loaded sprite`,
              'Add the object sprite to the runtime manifest or rename the map object to a loaded texture key.',
              'runtime'
            );
          }
        });
      });
  });
}

function validateEnvironmentObjectParity(manifest, findings) {
  const validObjectNames = new Set(manifest.objects?.static || []);
  const environmentData = JSON.parse(fs.readFileSync(environmentDataPath, 'utf8'));
  const locations = environmentData.locations || {};

  Object.entries(locations).forEach(([locationId, locationDef]) => {
    (locationDef.clusters || []).forEach((cluster) => {
      (cluster.objects || []).forEach((objectDef) => {
        if (!validObjectNames.has(objectDef.sprite)) {
          addFinding(
            findings,
            'error',
            normalizeRelPath(environmentDataPath),
            `environment object "${objectDef.sprite}" in ${locationId}/${cluster.id} is not in the runtime manifest`,
            'Only reference object textures that the live loader brings into the isometric runtime.',
            'runtime'
          );
        }
      });
    });
  });
}

async function validate(spec) {
  const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestPath, 'utf8'));
  const {
    gameplayDirs,
    cinematicDirs,
    conceptDirs,
    gameplayRules,
    cinematicRules,
    gameplayPatterns,
    cinematicPatterns,
    namedCharacterSheet,
    crowdSilhouettes,
    sceneBackdrops,
  } = getSpecLists(spec);

  const findings = [];
  const counts = {
    gameplay: 0,
    cinematic: 0,
    concept: 0,
    unclassified: 0,
    runtime: 0,
  };

  const pngFiles = walkPngs(path.join(repoRoot, 'assets'));
  const paletteSet = new Set(getAllPaletteColors().map((color) => color.hex.toUpperCase()));

  for (const filePath of pngFiles) {
    const relPath = normalizeRelPath(filePath);
    const assetClass = classifyAsset(relPath, gameplayDirs, cinematicDirs, conceptDirs);
    const fileName = path.basename(filePath);
    const parentDir = path.posix.dirname(relPath);

    counts[assetClass] = (counts[assetClass] || 0) + 1;

    try {
      const inspected = await inspectPng(filePath);
      const { width, height, imageData } = inspected;

      if (assetClass === 'unclassified') {
        addFinding(
          findings,
          'warn',
          relPath,
          'file is outside the approved gameplay/cinematic/concept directories',
          'Move it into a shipping class or mark it as staging-only reference art.',
          assetClass
        );
        continue;
      }

      if (assetClass === 'gameplay' && parentDir === 'assets/sprites/characters') {
        if (!fileName.endsWith('-sheet.png')) {
          addFinding(
            findings,
            'error',
            relPath,
            `forbidden standalone gameplay character sprite (${width}x${height})`,
            'Move standalone sprites out of shipping gameplay paths or regenerate them as sheets only.',
            assetClass
          );
          continue;
        }

        if (namedCharacterSheet && (width !== namedCharacterSheet.width || height !== namedCharacterSheet.height)) {
          addFinding(
            findings,
            'error',
            relPath,
            `named character sheet is ${width}x${height}, expected ${namedCharacterSheet.width}x${namedCharacterSheet.height}`,
            'Regenerate the sheet with the approved 4x6 live runtime contract.',
            assetClass
          );
        }

        if (!matchesAnyPattern(fileName, { characterSheet: gameplayPatterns.characterSheet })) {
          addFinding(
            findings,
            'error',
            relPath,
            'character sheet filename does not match the gameplay naming pattern',
            'Use <name>-sheet.png for shipping character sheets.',
            assetClass
          );
        }
      }

      if (assetClass === 'gameplay' && parentDir === 'assets/sprites/crowd') {
        const crowdMatch = crowdSilhouettes.find((frame) => frame.width === width && frame.height === height);
        if (!crowdMatch) {
          addFinding(
            findings,
            'error',
            relPath,
            `crowd silhouette ${width}x${height} does not match the spec`,
            'Keep crowd silhouettes at 8x16 so they remain cheap and readable.',
            assetClass
          );
        }
      }

      if (assetClass === 'gameplay' && (
        parentDir === 'assets/sprites/tiles'
        || parentDir === 'assets/sprites/objects'
        || parentDir === 'assets/sprites/particles'
      )) {
        if (width > gameplayRules.maxSourceDimension || height > gameplayRules.maxSourceDimension) {
          addFinding(
            findings,
            'warn',
            relPath,
            `source art ${width}x${height} exceeds gameplay max ${gameplayRules.maxSourceDimension}px`,
            'Downscale, split, or reclassify the asset before promotion.',
            assetClass
          );
        }
      }

      if (assetClass === 'gameplay') {
        const allowPartialAlpha = parentDir === 'assets/sprites/particles'
          || (parentDir === 'assets/sprites/objects' && fileName.endsWith('-sheet.png'));
        const { nonPalettePixels, partialAlphaPixels } = analyzeGameplayPixels(imageData, paletteSet, allowPartialAlpha);

        if (nonPalettePixels > 0) {
          addFinding(
            findings,
            'error',
            relPath,
            `${nonPalettePixels} opaque pixels fall outside the approved indexed ramp palette`,
            'Quantize the gameplay art back to the shipping palette canon.',
            assetClass
          );
        }

        if (!allowPartialAlpha && partialAlphaPixels > 0) {
          addFinding(
            findings,
            'error',
            relPath,
            `${partialAlphaPixels} gameplay pixels use partial alpha`,
            'Gameplay pixel art should use clean opaque edges; move soft transparency into particles or animated FX sheets only.',
            assetClass
          );
        }
      }

      if (assetClass === 'cinematic' && parentDir === 'assets/scenes') {
        const sceneRule = cinematicRules.sceneSize || sceneBackdrops[0];
        if (sceneRule && (width !== sceneRule.width || height !== sceneRule.height)) {
          addFinding(
            findings,
            'warn',
            relPath,
            `scene backdrop is ${width}x${height}, expected ${sceneRule.width}x${sceneRule.height}`,
            'Keep interstitials locked to the approved 16:9 target so they do not need special-case cropping.',
            assetClass
          );
        }

        if (!matchesAnyPattern(fileName, { scene: cinematicPatterns.scene })) {
          addFinding(
            findings,
            'warn',
            relPath,
            'scene filename does not match the cinematic naming pattern',
            'Use opening-screen.png or scene-<district>[-time].png.',
            assetClass
          );
        }
      }

      if (assetClass === 'cinematic' && parentDir === 'assets/sprites/portraits') {
        if (
          width !== height
          || width < cinematicRules.portraitMinSize.width
          || height < cinematicRules.portraitMinSize.height
        ) {
          addFinding(
            findings,
            'warn',
            relPath,
            `portrait is ${width}x${height} but must be square and at least ${cinematicRules.portraitMinSize.width}x${cinematicRules.portraitMinSize.height}`,
            'Keep portraits square so they crop cleanly in dialogue and codex layouts.',
            assetClass
          );
        }

        if (!matchesAnyPattern(fileName, { portrait: cinematicPatterns.portrait })) {
          addFinding(
            findings,
            'warn',
            relPath,
            'portrait filename does not match the cinematic naming pattern',
            'Use a clean lowercase kebab-case name so portrait lookups stay predictable.',
            assetClass
          );
        }
      }
    } catch (error) {
      addFinding(
        findings,
        'error',
        relPath,
        error.message,
        'Fix the PNG before promotion. Broken or unreadable art should never ship.',
        assetClass
      );
    }
  }

  validateRuntimeManifest(runtimeManifest, spec, findings);
  validateMapParity(runtimeManifest, findings);
  validateEnvironmentObjectParity(runtimeManifest, findings);

  return {
    spec,
    findings,
    scannedCount: pngFiles.length,
    counts,
  };
}

function renderMarkdownReport(result) {
  const { spec, findings, scannedCount, counts } = result;
  const severityCounts = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push('# Art Asset Audit');
  lines.push('');
  lines.push(`- Spec version: ${spec.version}`);
  lines.push(`- Target look: ${spec.targetLook}`);
  lines.push(`- Projection: ${spec.projectionMode}`);
  lines.push(`- PNG files scanned: ${scannedCount}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Gameplay assets | ${counts.gameplay} |`);
  lines.push(`| Cinematic assets | ${counts.cinematic} |`);
  lines.push(`| Concept assets | ${counts.concept} |`);
  lines.push(`| Unclassified assets | ${counts.unclassified} |`);
  lines.push(`| Errors | ${severityCounts.error || 0} |`);
  lines.push(`| Warnings | ${severityCounts.warn || 0} |`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('No non-compliant assets found.');
    return `${lines.join('\n')}\n`;
  }

  ['error', 'warn'].forEach((severity) => {
    const rows = findings.filter((finding) => finding.severity === severity);
    if (rows.length === 0) return;

    lines.push(`## ${severity === 'error' ? 'Errors' : 'Warnings'}`);
    lines.push('');
    lines.push('| File | Class | Issue | Hint |');
    lines.push('| --- | --- | --- | --- |');
    rows.forEach((finding) => {
      lines.push(`| ${escapeCell(finding.file)} | ${escapeCell(finding.assetClass)} | ${escapeCell(finding.issue)} | ${escapeCell(finding.hint || '')} |`);
    });
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node tools/validate-gameplay-assets.cjs [--strict] [--report <path>]');
    console.log('Audits gameplay, cinematic, and concept asset directories against docs/art-bible/gameplay-asset-spec.json.');
    process.exit(0);
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const result = await validate(spec);
  const findings = result.findings;
  const reportPath = args.reportPath;
  const hasErrors = findings.some((finding) => finding.severity === 'error');
  const hasWarnings = findings.some((finding) => finding.severity === 'warn');
  const shouldFail = hasErrors || (args.strict && hasWarnings);

  console.log(`Gameplay art target: ${result.spec.targetLook}`);
  console.log(`Projection mode: ${result.spec.projectionMode}`);
  console.log(`Scanned PNG files: ${result.scannedCount}`);

  if (findings.length === 0) {
    console.log('No non-compliant art assets found.');
  } else {
    findings.slice(0, 80).forEach((finding) => {
      const hint = finding.hint ? ` | ${finding.hint}` : '';
      console.log(`[${finding.severity}] ${finding.assetClass} ${finding.file} - ${finding.issue}${hint}`);
    });

    if (findings.length > 80) {
      console.log(`... ${findings.length - 80} additional findings omitted`);
    }
  }

  if (reportPath) {
    const markdown = renderMarkdownReport(result);
    const absoluteReportPath = path.isAbsolute(reportPath) ? reportPath : path.join(repoRoot, reportPath);
    fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
    fs.writeFileSync(absoluteReportPath, markdown, 'utf8');
    console.log(`Markdown report written to ${normalizeRelPath(absoluteReportPath)}`);
  }

  if (shouldFail) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
