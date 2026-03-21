#!/usr/bin/env node

/**
 * review-locations.cjs
 *
 * Auto-populates the 5 location review markdown files with structural data
 * extracted from isometric map JSON files, environment-objects.json clusters,
 * and gameplay-asset-spec.json density thresholds.
 *
 * Usage: node tools/review-locations.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const LOCATIONS = [
  { id: 'a-famosa-gate', title: 'A Famosa Gate' },
  { id: 'rua-direita', title: 'Rua Direita' },
  { id: 'st-pauls-church', title: "St. Paul's Church" },
  { id: 'waterfront', title: 'Waterfront' },
  { id: 'kampung', title: 'Kampung' },
];

const REVIEW_DATE = '2026-03-21';
const REVIEWER = 'auto-reviewer-v1';

const LAYER_NAMES = ['Props', 'Overhang', 'Canopy', 'Highlights'];

// --- Load shared data ---

const assetSpec = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/art-bible/gameplay-asset-spec.json'), 'utf8')
);
const densityReqs = assetSpec.densityRequirements;
const minPerLayer = densityReqs.minObjectsPerLayer; // { Props: 5, Overhang: 3, Canopy: 2, Highlights: 2 }
const minClusters = densityReqs.minClustersPerLocation; // 6

const envObjects = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/environment-objects.json'), 'utf8')
);

// --- Helpers ---

function getLayerObjects(mapData, layerName) {
  const layer = mapData.layers.find(
    (l) => l.name === layerName && l.type === 'objectgroup'
  );
  return layer ? layer.objects || [] : [];
}

function densityAssessment(count, threshold) {
  if (count < threshold) return 'sparse';
  if (count >= threshold * 2) return 'dense';
  return 'adequate';
}

/**
 * Occlusion assessment: how many objects in Overhang/Canopy layers have Y
 * coordinates that overlap with Props layer objects.
 *
 * We define overlap as: an overhang/canopy object whose vertical extent
 * [y - height, y] overlaps with a props object's vertical extent [y - height, y].
 * We use a generous 32px tolerance to account for isometric projection.
 */
function occlusionAssessment(propsObjs, upperObjs) {
  if (upperObjs.length === 0) return 'flat';

  let overlapCount = 0;
  for (const upper of upperObjs) {
    const uTop = upper.y - (upper.height || 16);
    const uBottom = upper.y;
    for (const prop of propsObjs) {
      const pTop = prop.y - (prop.height || 16);
      const pBottom = prop.y;
      // Check if vertical extents overlap (with tolerance)
      const tolerance = 32;
      if (uBottom + tolerance >= pTop && uTop - tolerance <= pBottom) {
        overlapCount++;
        break; // count each upper object at most once
      }
    }
  }

  if (overlapCount === 0) return 'flat';
  if (overlapCount >= upperObjs.length * 0.5) return 'good';
  return 'partial';
}

function materialVarietyLabel(count) {
  if (count <= 3) return 'low';
  if (count <= 7) return 'medium';
  return 'high';
}

// --- Scene backdrop name mapping ---

function scenePrefix(locationId) {
  const map = {
    'a-famosa-gate': 'a-famosa',
    'rua-direita': 'rua-direita',
    'st-pauls-church': 'st-pauls-church',
    'waterfront': 'waterfront',
    'kampung': 'kampung',
  };
  return map[locationId] || locationId;
}

// --- Process each location ---

for (const loc of LOCATIONS) {
  const mapPath = path.join(ROOT, 'assets/maps', `${loc.id}-iso.json`);
  const reviewPath = path.join(
    ROOT,
    'docs/art-bible/corrective-waves/location-reviews',
    `${loc.id}.md`
  );

  if (!fs.existsSync(mapPath)) {
    console.warn(`[SKIP] Map file not found: ${mapPath}`);
    continue;
  }
  if (!fs.existsSync(reviewPath)) {
    console.warn(`[SKIP] Review template not found: ${reviewPath}`);
    continue;
  }

  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  // 1. Gather objects per layer
  const layerData = {};
  const allSpriteNames = new Set();

  for (const layerName of LAYER_NAMES) {
    const objects = getLayerObjects(mapData, layerName);
    const spriteNames = new Set(objects.map((o) => o.name).filter(Boolean));
    spriteNames.forEach((s) => allSpriteNames.add(s));
    layerData[layerName] = {
      objects,
      count: objects.length,
      spriteNames,
    };
  }

  // 2. Density assessment per layer
  for (const layerName of LAYER_NAMES) {
    const threshold = minPerLayer[layerName] || 2;
    layerData[layerName].density = densityAssessment(
      layerData[layerName].count,
      threshold
    );
  }

  // 3. Occlusion assessment
  const propsObjs = layerData['Props'].objects;
  const overhangObjs = layerData['Overhang'].objects;
  const canopyObjs = layerData['Canopy'].objects;

  layerData['Props'].occlusion = occlusionAssessment(
    propsObjs,
    [...overhangObjs, ...canopyObjs]
  );
  layerData['Overhang'].occlusion = occlusionAssessment(propsObjs, overhangObjs);
  layerData['Canopy'].occlusion = occlusionAssessment(propsObjs, canopyObjs);
  layerData['Highlights'].occlusion = 'n/a';

  // 4. Cluster data from environment-objects.json
  const locEnv = envObjects.locations[loc.id];
  const clusters = locEnv ? locEnv.clusters || [] : [];
  const clusterIds = clusters.map((c) => c.id);

  // Per-cluster: collect sprite names for material variety
  const clusterRows = clusters.map((cluster) => {
    const clusterSprites = new Set(
      (cluster.objects || []).map((o) => o.sprite).filter(Boolean)
    );
    const variety = materialVarietyLabel(clusterSprites.size);
    // Check if props are present (has objects)
    const hasProps = cluster.objects && cluster.objects.length > 0 ? 'yes' : 'no';
    // Ultima VIII bar: variety must be medium or high AND at least 3 objects
    const barMet =
      clusterSprites.size >= 3 && cluster.objects.length >= 3 ? 'yes' : 'no';
    return { id: cluster.id, hasProps, variety, barMet };
  });

  // 5. Overall material variety across all map layers
  const totalMaterialVariety = allSpriteNames.size;

  // 6. Overall verdict
  const allLayersMeetThreshold = LAYER_NAMES.every(
    (ln) => layerData[ln].density !== 'sparse'
  );
  const clustersMeetThreshold = clusters.length >= minClusters;
  let overallVerdict;
  if (allLayersMeetThreshold && clustersMeetThreshold) {
    overallVerdict = 'yes';
  } else if (allLayersMeetThreshold || clustersMeetThreshold) {
    overallVerdict = 'partially';
  } else {
    overallVerdict = 'no';
  }

  // Priority fixes
  const priorityFixes = [];
  for (const ln of LAYER_NAMES) {
    if (layerData[ln].density === 'sparse') {
      priorityFixes.push(
        `${ln} layer is sparse (${layerData[ln].count} objects, threshold ${minPerLayer[ln] || 2})`
      );
    }
  }
  if (!clustersMeetThreshold) {
    priorityFixes.push(
      `Only ${clusters.length} clusters (need ${minClusters}+)`
    );
  }
  const flatLayers = LAYER_NAMES.filter(
    (ln) => layerData[ln].occlusion === 'flat' && ln !== 'Highlights'
  );
  if (flatLayers.length > 0) {
    priorityFixes.push(
      `Flat occlusion on: ${flatLayers.join(', ')} — add vertical layering`
    );
  }

  // Recommended wave action
  let waveAction;
  if (overallVerdict === 'yes' && flatLayers.length === 0) {
    waveAction = 'keep';
  } else if (overallVerdict === 'no') {
    waveAction = 'major rework';
  } else {
    waveAction = 'tune details';
  }

  // --- Build the scene prefix for backdrop filenames ---
  const prefix = scenePrefix(loc.id);

  // --- Generate markdown ---

  const md = `# Location Review: ${loc.title}

**Map file**: assets/maps/${loc.id}-iso.json
**Review date**: ${REVIEW_DATE}
**Reviewer**: ${REVIEWER}

## Time-of-Day Screenshots

### Dawn
- **Scene backdrop**: scene-${prefix}-dawn.png
- **Density score** (1-5): _
- **Physicality score** (1-5): _
- **Material clarity score** (1-5): _
- **Historical relevance score** (1-5): _
- **Shadow consistency**: _pass / fail_
- **Notes**:

### Day
- **Scene backdrop**: scene-${prefix}.png
- **Density score** (1-5): _
- **Physicality score** (1-5): _
- **Material clarity score** (1-5): _
- **Historical relevance score** (1-5): _
- **Shadow consistency**: _pass / fail_
- **Notes**:

### Dusk
- **Scene backdrop**: scene-${prefix}-dusk.png
- **Density score** (1-5): _
- **Physicality score** (1-5): _
- **Material clarity score** (1-5): _
- **Historical relevance score** (1-5): _
- **Shadow consistency**: _pass / fail_
- **Notes**:

### Night
- **Scene backdrop**: scene-${prefix}-night.png
- **Density score** (1-5): _
- **Physicality score** (1-5): _
- **Material clarity score** (1-5): _
- **Historical relevance score** (1-5): _
- **Shadow consistency**: _pass / fail_
- **Notes**:

## Gameplay Layer Review

| Layer | Object Count | Density Assessment | Occlusion Assessment |
|-------|-------------|-------------------|---------------------|
| Props | ${layerData['Props'].count} | ${layerData['Props'].density} | ${layerData['Props'].occlusion} |
| Overhang | ${layerData['Overhang'].count} | ${layerData['Overhang'].density} | ${layerData['Overhang'].occlusion} |
| Canopy | ${layerData['Canopy'].count} | ${layerData['Canopy'].density} | ${layerData['Canopy'].occlusion} |
| Highlights | ${layerData['Highlights'].count} | ${layerData['Highlights'].density} | ${layerData['Highlights'].occlusion} |

**Material variety (distinct sprite types across all layers)**: ${totalMaterialVariety}

## Cluster Coverage

| Cluster ID | Props Present | Material Variety | Ultima VIII Bar Met? |
|------------|--------------|-----------------|---------------------|
${clusterRows.map((r) => `| ${r.id} | ${r.hasProps} | ${r.variety} | ${r.barMet} |`).join('\n')}

**Total clusters**: ${clusters.length} (threshold: ${minClusters})

## Overall Verdict

- **Meets Ultima VIII density bar**: ${overallVerdict}
- **Priority fixes**: ${priorityFixes.length > 0 ? priorityFixes.join('; ') : 'none'}
- **Recommended wave action**: ${waveAction}
`;

  fs.writeFileSync(reviewPath, md, 'utf8');
  console.log(`[OK] ${loc.id}: ${layerData['Props'].count} Props, ${layerData['Overhang'].count} Overhang, ${layerData['Canopy'].count} Canopy, ${layerData['Highlights'].count} Highlights | ${clusters.length} clusters | verdict: ${overallVerdict}`);
}

console.log('\nDone. All location reviews updated.');
