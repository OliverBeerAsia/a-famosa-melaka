#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const specPath = path.join(repoRoot, 'docs', 'art-bible', 'gameplay-asset-spec.json');

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

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Unsupported PNG: ${filePath}`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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
    sheetFrames: spec.modules?.characterSheetFrame || [],
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

function validate(spec) {
  const {
    gameplayDirs,
    cinematicDirs,
    conceptDirs,
    gameplayRules,
    cinematicRules,
    gameplayPatterns,
    cinematicPatterns,
    sheetFrames,
    crowdSilhouettes,
    sceneBackdrops,
  } = getSpecLists(spec);

  const findings = [];
  const counts = {
    gameplay: 0,
    cinematic: 0,
    concept: 0,
    unclassified: 0,
  };

  const pngFiles = walkPngs(path.join(repoRoot, 'assets'));

  pngFiles.forEach((filePath) => {
    const relPath = normalizeRelPath(filePath);
    const assetClass = classifyAsset(relPath, gameplayDirs, cinematicDirs, conceptDirs);
    const fileName = path.basename(filePath);
    const parentDir = path.posix.dirname(relPath);

    counts[assetClass] = (counts[assetClass] || 0) + 1;

    try {
      const size = readPngSize(filePath);

      if (assetClass === 'unclassified') {
        addFinding(
          findings,
          'warn',
          relPath,
          'file is outside the approved gameplay/cinematic/concept directories',
          'Move it into a shipping class or mark it as staging-only reference art.',
          assetClass
        );
        return;
      }

      if (assetClass === 'gameplay' && parentDir === 'assets/sprites/characters') {
        if (!fileName.endsWith('-sheet.png')) {
          addFinding(
            findings,
            'warn',
            relPath,
            `legacy standalone character sprite (${size.width}x${size.height})`,
            'Promote it to a sheet or move it out of gameplay shipping paths.',
            assetClass
          );
          return;
        }

        const matchingFrame = sheetFrames.find((frame) => size.width % frame.width === 0 && size.height % frame.height === 0);
        if (!matchingFrame) {
          addFinding(
            findings,
            'warn',
            relPath,
            `sheet size ${size.width}x${size.height} does not divide cleanly into an approved character frame`,
            'Rebuild the sheet around 16x32 or 24x48 frames and keep the sheet grid consistent.',
            assetClass
          );
        } else {
          const columns = size.width / matchingFrame.width;
          const rows = size.height / matchingFrame.height;
          if (columns !== 4 || rows !== 4) {
            addFinding(
              findings,
              'warn',
              relPath,
              `character sheet grid is ${columns}x${rows}, expected 4x4`,
              'Keep the frame grid stable so import, collision, and animation timing stay predictable.',
              assetClass
            );
          }
        }
      }

      if (assetClass === 'gameplay' && (parentDir === 'assets/sprites/tiles' || parentDir === 'assets/sprites/objects' || parentDir === 'assets/sprites/particles')) {
        if (size.width > gameplayRules.maxSourceDimension || size.height > gameplayRules.maxSourceDimension) {
          addFinding(
            findings,
            'warn',
            relPath,
            `source art ${size.width}x${size.height} exceeds gameplay max ${gameplayRules.maxSourceDimension}px`,
            'Downscale, split, or reclassify the asset before promotion.',
            assetClass
          );
        }
      }

      if (assetClass === 'gameplay' && parentDir === 'assets/sprites/crowd') {
        const crowdMatch = crowdSilhouettes.find((frame) => frame.width === size.width && frame.height === size.height);
        if (!crowdMatch) {
          addFinding(
            findings,
            'warn',
            relPath,
            `crowd silhouette ${size.width}x${size.height} does not match the spec`,
            'Keep crowd silhouettes at 8x16 so they stay readable as low-cost background support.',
            assetClass
          );
        }
      }

      if (assetClass === 'cinematic' && parentDir === 'assets/scenes') {
        const sceneRule = cinematicRules.sceneSize || sceneBackdrops[0];
        if (sceneRule && (size.width !== sceneRule.width || size.height !== sceneRule.height)) {
          addFinding(
            findings,
            'warn',
            relPath,
            `scene backdrop is ${size.width}x${size.height}, expected ${sceneRule.width}x${sceneRule.height}`,
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
        if (size.width !== size.height || size.width < cinematicRules.portraitMinSize.width || size.height < cinematicRules.portraitMinSize.height) {
          addFinding(
            findings,
            'warn',
            relPath,
            `portrait is ${size.width}x${size.height} but must be square and at least ${cinematicRules.portraitMinSize.width}x${cinematicRules.portraitMinSize.height}`,
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

      if (assetClass === 'gameplay' && parentDir === 'assets/sprites/characters') {
        if (!matchesAnyPattern(fileName, { characterSheet: gameplayPatterns.characterSheet })) {
          addFinding(
            findings,
            'warn',
            relPath,
            'character sheet filename does not match the gameplay naming pattern',
            'Use <name>-sheet.png for shipping character sheets.',
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
  });

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

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node tools/validate-gameplay-assets.cjs [--strict] [--report <path>]');
    console.log('Audits gameplay, cinematic, and concept asset directories against docs/art-bible/gameplay-asset-spec.json.');
    process.exit(0);
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const result = validate(spec);
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
    findings.slice(0, 50).forEach((finding) => {
      const hint = finding.hint ? ` | ${finding.hint}` : '';
      console.log(`[${finding.severity}] ${finding.assetClass} ${finding.file} - ${finding.issue}${hint}`);
    });

    if (findings.length > 50) {
      console.log(`... ${findings.length - 50} additional findings omitted`);
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

main();
