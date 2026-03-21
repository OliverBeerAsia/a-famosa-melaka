#!/usr/bin/env node

/**
 * validate-style.cjs
 *
 * Ultima VIII style compliance validator.  Complements the structural
 * validator (validate-gameplay-assets.cjs) with style-specific checks:
 *
 *   1. Prompt lint — banned/required style anchors in AI prompt docs
 *   2. Reference coverage — every shipping asset has a style-map entry
 *   3. Reference integrity — all u8References resolve to the ref manifest
 *   4. Status completeness — every style-map entry has status + wave
 *   5. Pixel analysis — anti-aliasing and smooth-gradient heuristics
 *   6. Portrait analysis — VGA-grade cluster count and silhouette contrast
 *
 * Usage:
 *   node tools/validate-style.cjs [--strict] [--report <path>] [--help]
 */

const fs = require('fs');
const path = require('path');
const {
  isCanvasAvailable,
  detectAntiAliasing,
  detectSmoothGradients,
  analyzePortraitClusters,
} = require('./pixel-analysis.cjs');

const repoRoot = path.join(__dirname, '..');
const specPath = path.join(repoRoot, 'docs', 'art-bible', 'gameplay-asset-spec.json');
const runtimeManifestPath = path.join(repoRoot, 'src', 'data', 'runtime-asset-manifest.json');
const styleMapPath = path.join(repoRoot, 'docs', 'art-bible', 'shipping-asset-style-map.json');
const referenceManifestPath = path.join(repoRoot, 'docs', 'art-bible', 'ultima8-reference-manifest.json');
const promptsDir = path.join(repoRoot, 'tools', 'ai-prompts');

/* ── CLI ─────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { strict: false, help: false, reportPath: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--strict') args.strict = true;
    else if (v === '--help' || v === '-h') args.help = true;
    else if (v === '--report') { args.reportPath = argv[i + 1] || null; i++; }
    else if (v.startsWith('--report=')) args.reportPath = v.slice('--report='.length) || null;
  }
  return args;
}

/* ── Findings ────────────────────────────────────────────────────── */

function addFinding(findings, severity, file, issue, hint, category) {
  findings.push({ severity, file, issue, hint, category });
}

/* ── File walkers ────────────────────────────────────────────────── */

function walkFiles(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (extensions.some((ext) => e.name.endsWith(ext))) results.push(p);
    });
  }
  walk(dir);
  return results;
}

function relPath(p) {
  return path.relative(repoRoot, p).split(path.sep).join('/');
}

/* ── 1. Prompt Lint ──────────────────────────────────────────────── */

function stripNegationContext(text) {
  let cleaned = text.replace(/BANNED TECHNIQUES:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '');
  cleaned = cleaned.replace(/^.*\bNO\b.*$/gim, '');
  return cleaned;
}

function lintPrompts(findings, bannedAnchors) {
  const requiredAnchors = ['Ultima VIII', 'pixel art'];
  const files = walkFiles(promptsDir, ['.txt', '.json', '.md']);

  files.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const contentForBanCheck = stripNegationContext(content);
    const lowerBan = contentForBanCheck.toLowerCase();
    const lower = content.toLowerCase();
    const rel = relPath(filePath);

    bannedAnchors.forEach((anchor) => {
      const anchorLower = anchor.toLowerCase();
      if (lowerBan.includes(anchorLower)) {
        addFinding(findings, 'error', rel, `contains banned style anchor "${anchor}"`, `Remove or replace "${anchor}" with Ultima VIII-specific language.`, 'prompt-lint');
      }
    });

    const hasRequired = requiredAnchors.some((a) => lower.includes(a.toLowerCase()));
    if (!hasRequired) {
      addFinding(findings, 'warn', rel, 'missing required style anchor (Ultima VIII or pixel art)', 'Ensure the prompt references Ultima VIII style explicitly.', 'prompt-lint');
    }
  });
}

/* ── 2 & 3. Reference Coverage + Integrity ───────────────────────── */

function checkReferenceCoverage(findings, manifest, styleMap, refManifest, minimumCoverage) {
  const validRefIds = new Set(Object.keys(refManifest.references || {}));
  const assets = styleMap.assets || {};

  const expected = [];

  (manifest.characters?.named || []).forEach((id) => {
    expected.push({ section: 'characters', id, assetClass: 'named-character-sheet' });
    expected.push({ section: 'portraits', id, assetClass: 'portrait' });
  });
  (manifest.crowd?.sprites || []).forEach((id) => {
    expected.push({ section: 'crowd', id, assetClass: 'crowd-silhouette' });
  });
  (manifest.tiles?.base || []).forEach((id) => {
    expected.push({ section: 'tiles.base', id, assetClass: 'base-tile' });
  });
  (manifest.tiles?.isometric || []).forEach((id) => {
    expected.push({ section: 'tiles.isometric', id, assetClass: 'iso-tile' });
  });
  (manifest.objects?.static || []).forEach((id) => {
    expected.push({ section: 'objects.static', id, assetClass: 'static-object' });
  });
  (manifest.objects?.animatedSheets || []).forEach((id) => {
    expected.push({ section: 'objects.animatedSheets', id, assetClass: 'animated-object' });
  });

  expected.forEach(({ section, id, assetClass }) => {
    const container = section.split('.').reduce((obj, key) => (obj || {})[key], assets);
    const entry = container?.[id];

    if (!entry) {
      addFinding(findings, 'error', `${section}/${id}`, 'shipping asset has no style-map entry', 'Run npm run sync:ultima8-refs to populate.', 'coverage');
      return;
    }

    const refs = entry.u8References || [];
    const minCount = minimumCoverage[assetClass] || 1;
    if (refs.length < minCount) {
      addFinding(findings, 'warn', `${section}/${id}`, `has ${refs.length} reference(s), minimum is ${minCount}`, 'Add Ultima VIII reference IDs to the style map entry.', 'coverage');
    }

    refs.forEach((refId) => {
      if (!validRefIds.has(refId)) {
        addFinding(findings, 'error', `${section}/${id}`, `references unknown ID "${refId}"`, 'Add the reference to ultima8-reference-manifest.json or fix the ID.', 'coverage');
      }
    });

    if (!entry.status) {
      addFinding(findings, 'warn', `${section}/${id}`, 'style-map entry has no status', 'Set status to keep, tune, or replace.', 'coverage');
    }
    if (entry.wave == null) {
      addFinding(findings, 'warn', `${section}/${id}`, 'style-map entry has no wave', 'Assign a corrective wave (1, 2, or 3).', 'coverage');
    }
  });
}

/* ── 5+6. Pixel + Portrait analysis ──────────────────────────────── */

function getThreshold(styleProfiles, assetClass, key, fallback) {
  return styleProfiles?.[assetClass]?.validationThresholds?.[key] ?? fallback;
}

async function runPixelAnalysis(findings, manifest, styleMap, styleProfiles) {
  if (!isCanvasAvailable()) {
    addFinding(findings, 'warn', 'system', 'canvas module not available; skipping pixel analysis', 'Install the canvas npm package for full style validation.', 'pixel');
    return;
  }

  // Build gameplay asset list with their asset classes
  const gameplayAssets = [];
  (manifest.characters?.named || []).forEach((id) => {
    gameplayAssets.push({ file: path.join(repoRoot, `assets/sprites/characters/${id}-sheet.png`), id, assetClass: 'named-character-sheet' });
  });
  (manifest.crowd?.sprites || []).forEach((id) => {
    gameplayAssets.push({ file: path.join(repoRoot, `assets/sprites/crowd/${id}.png`), id, assetClass: 'crowd-silhouette' });
  });
  (manifest.tiles?.base || []).forEach((id) => {
    gameplayAssets.push({ file: path.join(repoRoot, `assets/sprites/tiles/${id}.png`), id, assetClass: 'base-tile' });
  });
  (manifest.objects?.static || []).forEach((id) => {
    gameplayAssets.push({ file: path.join(repoRoot, `assets/sprites/objects/${id}.png`), id, assetClass: 'static-object' });
  });

  for (const asset of gameplayAssets) {
    if (!fs.existsSync(asset.file)) continue;
    const rel = relPath(asset.file);

    // Read thresholds from the profile for this asset class
    const aaThreshold = getThreshold(styleProfiles, asset.assetClass, 'maxAntiAliasingRatio', 0.02);
    const maxRun = getThreshold(styleProfiles, asset.assetClass, 'maxSmoothGradientRun', 4);
    const maxGradRatio = getThreshold(styleProfiles, asset.assetClass, 'maxSmoothGradientRatio', 0.05);

    const aaScore = await detectAntiAliasing(asset.file);
    if (aaScore !== null && aaScore > aaThreshold) {
      addFinding(findings, 'error', rel, `anti-aliasing detected (${(aaScore * 100).toFixed(1)}% partial-alpha edge pixels, threshold ${(aaThreshold * 100).toFixed(1)}%)`, 'Remove anti-aliasing; use hard pixel edges only.', 'pixel');
    }

    const gradScore = await detectSmoothGradients(asset.file, maxRun);
    if (gradScore !== null && gradScore > maxGradRatio) {
      addFinding(findings, 'error', rel, `smooth gradients detected (${(gradScore * 100).toFixed(1)}% of scanlines, threshold ${(maxGradRatio * 100).toFixed(1)}%)`, 'Replace smooth gradients with ordered dithering or flat color steps.', 'pixel');
    }
  }

  // Portraits — read thresholds from portrait profile
  const portraitAAThreshold = getThreshold(styleProfiles, 'portrait', 'maxAntiAliasingRatio', 0.10);
  const minClusters = getThreshold(styleProfiles, 'portrait', 'minColorClusters', 4);
  const maxClusters = getThreshold(styleProfiles, 'portrait', 'maxColorClusters', 256);

  for (const id of (manifest.characters?.named || [])) {
    const filePath = path.join(repoRoot, `assets/sprites/portraits/${id}.png`);
    if (!fs.existsSync(filePath)) continue;
    const rel = relPath(filePath);

    const clusters = await analyzePortraitClusters(filePath);
    if (clusters !== null) {
      if (clusters < minClusters) {
        addFinding(findings, 'warn', rel, `portrait has only ${clusters} color clusters (min ${minClusters})`, 'Add more distinct value bands for VGA-grade portrait treatment.', 'portrait');
      } else if (clusters > maxClusters) {
        addFinding(findings, 'warn', rel, `portrait has ${clusters} color clusters (max ${maxClusters})`, 'Reduce color bands for VGA-grade clarity.', 'portrait');
      }
    }

    const aaScore = await detectAntiAliasing(filePath);
    if (aaScore !== null && aaScore > portraitAAThreshold) {
      addFinding(findings, 'warn', rel, `portrait anti-aliasing is high (${(aaScore * 100).toFixed(1)}%, threshold ${(portraitAAThreshold * 100).toFixed(1)}%)`, 'Reduce soft edges for stronger silhouette readability.', 'portrait');
    }
  }
}

/* ── Main ────────────────────────────────────────────────────────── */

async function validateStyle() {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(runtimeManifestPath, 'utf8'));

  const styleMap = fs.existsSync(styleMapPath)
    ? JSON.parse(fs.readFileSync(styleMapPath, 'utf8'))
    : { version: 1, assets: {} };

  const refManifest = fs.existsSync(referenceManifestPath)
    ? JSON.parse(fs.readFileSync(referenceManifestPath, 'utf8'))
    : { version: 1, references: {} };

  const bannedAnchors = spec.bannedStyleAnchors || [];
  const minimumCoverage = spec.referenceRequirements?.minimumCoverage || {};
  const styleProfiles = spec.styleProfiles || {};

  const findings = [];

  lintPrompts(findings, bannedAnchors);
  checkReferenceCoverage(findings, manifest, styleMap, refManifest, minimumCoverage);
  await runPixelAnalysis(findings, manifest, styleMap, styleProfiles);

  return { spec, findings, styleMap, refManifest };
}

function escapeCell(v) {
  return String(v).replace(/\|/g, '\\|');
}

function renderReport(result) {
  const { spec, findings } = result;
  const byCategory = {};
  findings.forEach((f) => {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  });

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warnCount = findings.filter((f) => f.severity === 'warn').length;

  const lines = [];
  lines.push('# Style Compliance Audit');
  lines.push('');
  lines.push(`- Spec version: ${spec.version}`);
  lines.push(`- Style target: ${spec.targetLook}`);
  lines.push(`- Errors: ${errorCount}`);
  lines.push(`- Warnings: ${warnCount}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('All style checks passed.');
    return lines.join('\n') + '\n';
  }

  Object.entries(byCategory).forEach(([category, catFindings]) => {
    lines.push(`## ${category}`);
    lines.push('');
    lines.push('| Severity | File | Issue | Hint |');
    lines.push('| --- | --- | --- | --- |');
    catFindings.forEach((f) => {
      lines.push(`| ${f.severity} | ${escapeCell(f.file)} | ${escapeCell(f.issue)} | ${escapeCell(f.hint || '')} |`);
    });
    lines.push('');
  });

  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node tools/validate-style.cjs [--strict] [--report <path>] [--help]');
    console.log('');
    console.log('Checks Ultima VIII style compliance:');
    console.log('  - Prompt lint: banned/required style anchors');
    console.log('  - Reference coverage: every shipping asset mapped');
    console.log('  - Pixel analysis: anti-aliasing, gradient smoothness (thresholds from spec)');
    console.log('  - Portrait analysis: VGA-grade clusters, silhouette contrast');
    process.exit(0);
  }

  const result = await validateStyle();
  const { findings } = result;
  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasWarnings = findings.some((f) => f.severity === 'warn');
  const shouldFail = hasErrors || (args.strict && hasWarnings);

  console.log(`Style target: ${result.spec.targetLook}`);

  if (findings.length === 0) {
    console.log('All style checks passed.');
  } else {
    findings.slice(0, 80).forEach((f) => {
      const hint = f.hint ? ` | ${f.hint}` : '';
      console.log(`[${f.severity}] ${f.category} ${f.file} - ${f.issue}${hint}`);
    });
    if (findings.length > 80) {
      console.log(`... ${findings.length - 80} additional findings omitted`);
    }
  }

  if (args.reportPath) {
    const markdown = renderReport(result);
    const abs = path.isAbsolute(args.reportPath) ? args.reportPath : path.join(repoRoot, args.reportPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, markdown, 'utf8');
    console.log(`Report written to ${relPath(abs)}`);
  }

  if (shouldFail) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
