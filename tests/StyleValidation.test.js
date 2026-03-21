const fs = require('fs');
const path = require('path');

const REFERENCE_MANIFEST_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'ultima8-reference-manifest.json');
const STYLE_MAP_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'shipping-asset-style-map.json');
const SPEC_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'gameplay-asset-spec.json');
const RUNTIME_MANIFEST_PATH = path.join(__dirname, '..', 'src', 'data', 'runtime-asset-manifest.json');
const PROMPTS_DIR = path.join(__dirname, '..', 'tools', 'ai-prompts');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkTextFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith('.txt') || entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
        results.push(fullPath);
      }
    });
  }
  walk(dir);
  return results;
}

/* ── Reference manifest schema ───────────────────────────────────── */

describe('Reference manifest schema', () => {
  const VALID_TAGS = new Set([
    'character', 'ground-tile', 'wall-tile', 'prop', 'building',
    'portrait', 'environment-screenshot', 'map', 'animated',
    'walk-cycle', 'idle', 'vegetation', 'ui',
  ]);

  const VALID_APPROVED_FOR = new Set([
    'named-character-sheet', 'crowd-silhouette', 'base-tile', 'iso-tile',
    'static-object', 'animated-object', 'scene-backdrop', 'portrait',
  ]);

  test('reference manifest loads and has required structure', () => {
    const manifest = loadJson(REFERENCE_MANIFEST_PATH);
    expect(manifest.version).toBeGreaterThanOrEqual(1);
    expect(typeof manifest.sources).toBe('object');
    expect(typeof manifest.references).toBe('object');
    expect(Object.keys(manifest.references).length).toBeGreaterThan(0);
  });

  test('every reference entry has required fields and valid controlled vocabulary', () => {
    const manifest = loadJson(REFERENCE_MANIFEST_PATH);

    Object.entries(manifest.references).forEach(([id, ref]) => {
      expect(id).toMatch(/^u8-/);
      expect(ref).toHaveProperty('sourceKey');
      expect(manifest.sources).toHaveProperty(ref.sourceKey);
      expect(Array.isArray(ref.tags)).toBe(true);
      expect(ref.tags.length).toBeGreaterThan(0);
      ref.tags.forEach((tag) => {
        expect(VALID_TAGS).toContain(tag);
      });
      expect(Array.isArray(ref.approvedFor)).toBe(true);
      expect(ref.approvedFor.length).toBeGreaterThan(0);
      ref.approvedFor.forEach((af) => {
        expect(VALID_APPROVED_FOR).toContain(af);
      });
      expect(typeof ref.notes).toBe('string');
    });
  });
});

/* ── Style map schema ────────────────────────────────────────────── */

describe('Style map schema', () => {
  const VALID_STATUS = new Set(['keep', 'tune', 'replace']);
  const VALID_WAVES = new Set([1, 2, 3]);

  test('style map loads and has required structure', () => {
    const map = loadJson(STYLE_MAP_PATH);
    expect(map.version).toBeGreaterThanOrEqual(1);
    expect(typeof map.assets).toBe('object');
  });

  test('every style map entry has required fields', () => {
    const map = loadJson(STYLE_MAP_PATH);
    const assets = map.assets;

    function checkEntries(section) {
      Object.entries(section).forEach(([id, entry]) => {
        if (typeof entry !== 'object' || entry === null) return;
        // Skip nested containers (tiles.base, tiles.isometric, objects.static, objects.animatedSheets)
        if (!entry.assetClass) return;

        expect(entry).toHaveProperty('assetClass');
        expect(entry).toHaveProperty('runtimePath');
        expect(Array.isArray(entry.u8References)).toBe(true);
        expect(typeof entry.historicalNotes).toBe('string');
        expect(VALID_STATUS).toContain(entry.status);
        expect(VALID_WAVES).toContain(entry.wave);
        expect(typeof entry.gradeCard).toBe('object');
      });
    }

    checkEntries(assets.characters || {});
    checkEntries(assets.crowd || {});
    checkEntries(assets.tiles?.base || {});
    checkEntries(assets.tiles?.isometric || {});
    checkEntries(assets.objects?.static || {});
    checkEntries(assets.objects?.animatedSheets || {});
    checkEntries(assets.portraits || {});
    checkEntries(assets.scenes || {});
  });
});

/* ── Cross-reference integrity ───────────────────────────────────── */

describe('Cross-reference integrity', () => {
  test('all u8References in style map resolve to valid reference manifest entries', () => {
    const refs = loadJson(REFERENCE_MANIFEST_PATH);
    const map = loadJson(STYLE_MAP_PATH);
    const validIds = new Set(Object.keys(refs.references));

    const invalid = [];

    function check(section, label) {
      Object.entries(section).forEach(([id, entry]) => {
        if (!entry || !entry.u8References) return;
        entry.u8References.forEach((refId) => {
          if (!validIds.has(refId)) {
            invalid.push({ section: label, id, refId });
          }
        });
      });
    }

    const assets = map.assets;
    check(assets.characters || {}, 'characters');
    check(assets.crowd || {}, 'crowd');
    check(assets.tiles?.base || {}, 'tiles.base');
    check(assets.tiles?.isometric || {}, 'tiles.isometric');
    check(assets.objects?.static || {}, 'objects.static');
    check(assets.objects?.animatedSheets || {}, 'objects.animatedSheets');
    check(assets.portraits || {}, 'portraits');
    check(assets.scenes || {}, 'scenes');

    expect(invalid).toEqual([]);
  });

  test('every runtime manifest character has a style map entry', () => {
    const manifest = loadJson(RUNTIME_MANIFEST_PATH);
    const map = loadJson(STYLE_MAP_PATH);

    const unmapped = (manifest.characters?.named || []).filter(
      (id) => !map.assets?.characters?.[id]
    );
    expect(unmapped).toEqual([]);
  });

  test('every runtime manifest tile has a style map entry', () => {
    const manifest = loadJson(RUNTIME_MANIFEST_PATH);
    const map = loadJson(STYLE_MAP_PATH);

    const unmappedBase = (manifest.tiles?.base || []).filter(
      (id) => !map.assets?.tiles?.base?.[id]
    );
    const unmappedIso = (manifest.tiles?.isometric || []).filter(
      (id) => !map.assets?.tiles?.isometric?.[id]
    );
    expect(unmappedBase).toEqual([]);
    expect(unmappedIso).toEqual([]);
  });

  test('every runtime manifest object has a style map entry', () => {
    const manifest = loadJson(RUNTIME_MANIFEST_PATH);
    const map = loadJson(STYLE_MAP_PATH);

    const unmappedStatic = (manifest.objects?.static || []).filter(
      (id) => !map.assets?.objects?.static?.[id]
    );
    const unmappedAnim = (manifest.objects?.animatedSheets || []).filter(
      (id) => !map.assets?.objects?.animatedSheets?.[id]
    );
    expect(unmappedStatic).toEqual([]);
    expect(unmappedAnim).toEqual([]);
  });
});

/* ── Prompt lint ─────────────────────────────────────────────────── */

describe('Prompt lint', () => {
  test('shipping prompt files contain no banned style anchors', () => {
    const spec = loadJson(SPEC_PATH);
    const banned = spec.bannedStyleAnchors || [];
    if (banned.length === 0) return;

    const promptFiles = walkTextFiles(PROMPTS_DIR);
    const violations = [];

    promptFiles.forEach((filePath) => {
      let content = fs.readFileSync(filePath, 'utf8');
      // Strip negation context — terms in BANNED TECHNIQUES or "NO ..." lines are not violations
      content = content.replace(/BANNED TECHNIQUES:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '');
      content = content.replace(/^.*\bNO\b.*$/gim, '');
      const lower = content.toLowerCase();
      banned.forEach((anchor) => {
        if (lower.includes(anchor.toLowerCase())) {
          violations.push({
            file: path.relative(path.join(__dirname, '..'), filePath),
            anchor,
          });
        }
      });
    });

    expect(violations).toEqual([]);
  });

  test('shipping prompt files include at least one required style anchor', () => {
    const requiredAnchors = ['ultima viii', 'pixel art'];
    const promptFiles = walkTextFiles(PROMPTS_DIR).filter((f) => f.endsWith('.txt'));
    const missing = [];

    promptFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
      const hasAny = requiredAnchors.some((anchor) => content.includes(anchor));
      if (!hasAny) {
        missing.push(path.relative(path.join(__dirname, '..'), filePath));
      }
    });

    expect(missing).toEqual([]);
  });
});

/* ── Spec extension safety ───────────────────────────────────────── */

describe('Spec extension safety', () => {
  test('gameplay-asset-spec.json still has all required existing keys', () => {
    const spec = loadJson(SPEC_PATH);
    expect(spec.version).toBe(3);
    expect(spec.targetLook).toBeTruthy();
    expect(spec.projectionMode).toBe('isometric-2:1');
    expect(spec.assetClasses).toBeTruthy();
    expect(spec.modules).toBeTruthy();
    expect(spec.allowedDirectories).toBeTruthy();
    expect(spec.gameplayRules).toBeTruthy();
    expect(spec.cinematicRules).toBeTruthy();
    expect(spec.checklists).toBeTruthy();
    expect(spec.audit).toBeTruthy();
  });

  test('new style keys are present', () => {
    const spec = loadJson(SPEC_PATH);
    expect(spec.styleProfiles).toBeTruthy();
    expect(spec.referenceRequirements).toBeTruthy();
    expect(Array.isArray(spec.bannedStyleAnchors)).toBe(true);
    expect(spec.bannedStyleAnchors.length).toBeGreaterThan(0);
  });
});

/* ── Wave tracker ────────────────────────────────────────────────── */

describe('Wave tracker', () => {
  const WAVE_TRACKER_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'corrective-waves', 'wave-tracker.json');

  test('wave tracker has valid structure', () => {
    if (!fs.existsSync(WAVE_TRACKER_PATH)) return;
    const tracker = loadJson(WAVE_TRACKER_PATH);
    expect(tracker.version).toBeGreaterThanOrEqual(1);
    expect(tracker.waves).toBeTruthy();
    expect(tracker.waves['wave-1']).toBeTruthy();
    expect(tracker.waves['wave-2']).toBeTruthy();
    expect(tracker.waves['wave-3']).toBeTruthy();
  });
});

/* ── Pixel-level style compliance ────────────────────────────────── */

describe('Pixel-level style compliance', () => {
  const {
    isCanvasAvailable,
    detectAntiAliasing,
    detectSmoothGradients,
    analyzePortraitClusters,
    checkPaletteCompliance,
  } = require('../tools/pixel-analysis.cjs');
  const { getAllPaletteColors } = require('../tools/ultima8-graphics/palette.cjs');

  const spec = loadJson(SPEC_PATH);
  const manifest = loadJson(RUNTIME_MANIFEST_PATH);
  const profiles = spec.styleProfiles || {};

  const CHARACTERS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');
  const PORTRAITS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'portraits');

  if (!isCanvasAvailable()) return;

  test('Wave 1 character sheets have no anti-aliased edge pixels', async () => {
    const threshold = profiles['named-character-sheet']?.validationThresholds?.maxAntiAliasingRatio ?? 0.02;
    const failures = [];

    for (const id of manifest.characters.named) {
      const filePath = path.join(CHARACTERS_DIR, `${id}-sheet.png`);
      if (!fs.existsSync(filePath)) continue;
      const score = await detectAntiAliasing(filePath);
      if (score !== null && score > threshold) {
        failures.push({ id, score: (score * 100).toFixed(1) + '%' });
      }
    }

    expect(failures).toEqual([]);
  });

  test('Wave 1 character sheets use only approved palette colors', async () => {
    const paletteSet = new Set(getAllPaletteColors().map((c) => c.hex.toUpperCase()));
    const failures = [];

    for (const id of manifest.characters.named) {
      const filePath = path.join(CHARACTERS_DIR, `${id}-sheet.png`);
      if (!fs.existsSync(filePath)) continue;
      const result = await checkPaletteCompliance(filePath, paletteSet);
      if (result && result.nonPalettePixels > 0) {
        failures.push({ id, nonPalettePixels: result.nonPalettePixels });
      }
    }

    expect(failures).toEqual([]);
  });

  test('Wave 1 character sheets have no smooth gradients', async () => {
    const maxRun = profiles['named-character-sheet']?.validationThresholds?.maxSmoothGradientRun ?? 4;
    const maxRatio = profiles['named-character-sheet']?.validationThresholds?.maxSmoothGradientRatio ?? 0.05;
    const failures = [];

    for (const id of manifest.characters.named) {
      const filePath = path.join(CHARACTERS_DIR, `${id}-sheet.png`);
      if (!fs.existsSync(filePath)) continue;
      const score = await detectSmoothGradients(filePath, maxRun);
      if (score !== null && score > maxRatio) {
        failures.push({ id, score: (score * 100).toFixed(1) + '%' });
      }
    }

    expect(failures).toEqual([]);
  });

  test('Wave 1 portraits have VGA-grade color clusters', async () => {
    const minClusters = profiles.portrait?.validationThresholds?.minColorClusters ?? 4;
    const maxClusters = profiles.portrait?.validationThresholds?.maxColorClusters ?? 256;
    const failures = [];

    for (const id of manifest.characters.named) {
      const filePath = path.join(PORTRAITS_DIR, `${id}.png`);
      if (!fs.existsSync(filePath)) continue;
      const clusters = await analyzePortraitClusters(filePath);
      if (clusters !== null && (clusters < minClusters || clusters > maxClusters)) {
        failures.push({ id, clusters });
      }
    }

    expect(failures).toEqual([]);
  });
});

/* ── Grade card completeness ─────────────────────────────────────── */

describe('Grade card completeness', () => {
  test('Wave 1 assets have non-null grade cards after grading', () => {
    const styleMap = loadJson(STYLE_MAP_PATH);
    const assets = styleMap.assets || {};
    const ungradedCharacters = [];
    const ungradedPortraits = [];

    Object.entries(assets.characters || {}).forEach(([id, entry]) => {
      if (entry.wave === 1 && (!entry.gradeCard || entry.gradeCard.overallGrade === null)) {
        ungradedCharacters.push(id);
      }
    });

    Object.entries(assets.portraits || {}).forEach(([id, entry]) => {
      if (entry.wave === 1 && (!entry.gradeCard || entry.gradeCard.overallGrade === null)) {
        ungradedPortraits.push(id);
      }
    });

    expect(ungradedCharacters).toEqual([]);
    expect(ungradedPortraits).toEqual([]);
  });
});
