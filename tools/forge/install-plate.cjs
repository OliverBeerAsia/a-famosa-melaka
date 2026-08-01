#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — INSTALL PLATE
 * ============================
 * Promotes an ACCEPTED compositor run out of `tools/forge/staging/` into the
 * shipping tree, and folds its derived engine data into the location file.
 *
 * `compose-plate.cjs` deliberately writes nothing outside staging: a plate is
 * reviewed before it ships. This tool is the one-way door, and it is a script
 * rather than a pile of `cp` commands because the fold is not a copy — the
 * plate grows from native 320x180 to 640x360, so every coordinate the location
 * file already owned (items, lore objects, shade zones, sun anchor) has to be
 * rescaled and then re-snapped onto walkable ground.
 *
 * WHAT MOVES WHERE
 *   staging/<id>@3x.png     -> tools/forge/plate-masters/<plate.background>.png
 *                              (the day MASTER; relight-plates.cjs derives the
 *                              shipping day plate and all three ToD variants
 *                              from it — see that tool's header)
 *   staging/<id>-walk.png   -> assets/scenes/masks/<id>-walk.png
 *   staging/<id>-fg-N.png   -> tools/forge/plate-masters/overlays/<key>.png
 *   staging/<id>.derived.json -> merged into src/data/locations/<id>.location.json
 *
 * WHAT IS KEPT FROM THE OLD LOCATION FILE
 * Everything the compositor has no opinion about: name, audio, visual, crowd
 * cast/density, items, lore objects, transition requirements. Those are design
 * data, not plate data.
 *
 * AFTER RUNNING: `npm run forge:relight <id>` (the plate this tool installs is
 * a master; nothing in assets/scenes/ is written here).
 *
 * CLI
 *   node tools/forge/install-plate.cjs rua-direita
 *   node tools/forge/install-plate.cjs rua-direita --dry
 *   node tools/forge/install-plate.cjs rua-direita --from tools/forge/install-snapshot
 *   node tools/forge/install-plate.cjs waterfront --spawn-derived
 *
 * --from <dir>       read the accepted run from somewhere other than staging/.
 *                    Staging is a scratch directory the kit tools re-render at
 *                    will; installing a REVIEWED plate means installing the
 *                    exact bytes that were reviewed, so an accepted run is
 *                    snapshotted out of staging and installed from the copy.
 * --spawn-derived    take transition spawnAt from the compositor rather than
 *                    from the prior location file. The default (prior wins) is
 *                    right when the TARGET plate is unchanged; it is wrong when
 *                    a whole batch of plates is rebuilt together, because then
 *                    the prior values are stale coordinates in a plate size
 *                    that no longer exists.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const REPO = path.resolve(__dirname, '../..');
const STAGING = path.join(__dirname, 'staging');
const MASTERS = path.join(__dirname, 'plate-masters');
const SCENES = path.join(REPO, 'assets', 'scenes');
const MASKS = path.join(SCENES, 'masks');
const OVERLAY_MASTERS = path.join(MASTERS, 'overlays');
const LOC_DIR = path.join(REPO, 'src', 'data', 'locations');

/** Compositor light kinds -> the four kinds relight-plates.cjs can bake. */
const LIGHT_TYPE_MAP = { fire: 'cookingFire', cookfire: 'cookingFire' };

/** Compositor animation kinds -> the spritesheets BootScene actually registers. */
const ANIM_TYPE_MAP = {
  'cloth-flutter': 'awning-flutter',
  'laundry-sway': 'awning-flutter',
  'foliage-sway': 'palm-sway',
  'torch-flicker': 'torch',
  birds: 'seagull',
  smoke: 'smoke',
};

// ---------------------------------------------------------------------------
// walk mask
// ---------------------------------------------------------------------------

async function readMask(file) {
  const img = await loadImage(file);
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  return {
    width: img.width,
    height: img.height,
    walkable(x, y) {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) return false;
      return data[(py * img.width + px) * 4] >= 128;
    },
  };
}

/**
 * Nearest walkable pixel to (x,y), searched in expanding square rings so the
 * result is deterministic and biased to the smallest possible move.
 * Returns null when nothing walkable is within `maxR`.
 */
function snapToWalkable(mask, x, y, maxR = 40) {
  if (mask.walkable(x, y)) return { x, y, moved: 0 };
  for (let r = 1; r <= maxR; r++) {
    let best = null;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!mask.walkable(x + dx, y + dy)) continue;
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2 || (d2 === best.d2 && (dy < best.dy || (dy === best.dy && dx < best.dx)))) {
          best = { dx, dy, d2 };
        }
      }
    }
    if (best) return { x: x + best.dx, y: y + best.dy, moved: r };
  }
  return null;
}

// ---------------------------------------------------------------------------
function copy(src, dst, dry) {
  if (!fs.existsSync(src)) throw new Error(`missing staging file: ${path.relative(REPO, src)}`);
  if (dry) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

async function install(id, opts = {}) {
  const src = opts.from ? path.resolve(REPO, opts.from) : STAGING;
  const derivedFile = path.join(src, `${id}.derived.json`);
  const locFile = path.join(LOC_DIR, `${id}.location.json`);
  const derived = JSON.parse(fs.readFileSync(derivedFile, 'utf8'));
  const old = JSON.parse(fs.readFileSync(locFile, 'utf8'));
  const notes = [];

  const nw = derived.world.nativeWidth;
  const nh = derived.world.nativeHeight;
  const fx = nw / old.world.nativeWidth;
  const fy = nh / old.world.nativeHeight;
  if (fx !== fy) notes.push(`WARNING: non-uniform rescale ${fx}x${fy} — check composition`);

  const mask = await readMask(path.join(src, `${id}-walk.png`));
  if (mask.width !== nw || mask.height !== nh) {
    throw new Error(`walk mask is ${mask.width}x${mask.height}, expected ${nw}x${nh}`);
  }

  // --- assets --------------------------------------------------------------
  // TWO DIFFERENT NAMES, and they are not always the same string.
  //
  //   plate.background  a TEXTURE KEY. BootScene's sceneMapping registers
  //                     'scene-a-famosa-gate' -> scenes/scene-a-famosa.png and
  //                     'scene-st-pauls-church' -> scenes/scene-st-pauls.png.
  //                     Rewriting it points the runtime at a texture nobody
  //                     loaded, and the day plate silently fails to appear.
  //   plateStem         the FILE stem, shared with the ToD variants, and the
  //                     only thing relight-plates.cjs looks at. Writing the
  //                     master under the KEY instead left the Forge a-famosa
  //                     plate stranded in plate-masters/ while relight kept
  //                     upscaling the superseded 960x540 one into a blur.
  //
  // So: the key is carried through untouched, the stem decides the filename.
  const backgroundKey = old.plate.background;                // "scene-a-famosa-gate"
  const variantStem = Object.values(old.plate.variants || {})
    .map((v) => String(v).replace(/-(dawn|dusk|night)$/, ''))
    .find(Boolean);
  const plateStem = variantStem || backgroundKey;            // "scene-a-famosa"
  copy(path.join(src, `${id}@3x.png`), path.join(MASTERS, `${plateStem}.png`), opts.dry);
  copy(path.join(src, `${id}-walk.png`), path.join(MASKS, `${id}-walk.png`), opts.dry);
  // Overlays are masters, exactly like the plate: relight-plates.cjs reads the
  // native cut-out and writes the 3x day/dawn/dusk/night sprites into assets/.
  (derived.overlays || []).forEach((o) => {
    copy(path.join(src, o.sprite), path.join(OVERLAY_MASTERS, `${o.key}.png`), opts.dry);
  });

  // --- rescale + re-snap the design data the compositor does not own --------
  const rescalePoint = (p) => ({ ...p, x: Math.round(p.x * fx), y: Math.round(p.y * fy) });
  const reground = (label, list) => (list || []).map((entry) => {
    const p = rescalePoint(entry);
    const snapped = snapToWalkable(mask, p.x, p.y);
    if (!snapped) {
      notes.push(`${label} "${entry.id || entry.key}" -> (${p.x},${p.y}) has no walkable pixel within 40px — placed as-is, FIX BY HAND`);
      return p;
    }
    if (snapped.moved) {
      notes.push(`${label} "${entry.id || entry.key}" moved ${snapped.moved}px to walkable ground: (${p.x},${p.y}) -> (${snapped.x},${snapped.y})`);
    }
    return { ...p, x: snapped.x, y: snapped.y };
  });

  const items = reground('item', old.items);
  const loreObjects = reground('lore', old.loreObjects);

  const scaleRect = (r) => ({
    ...r,
    x: Math.round(r.x * fx), y: Math.round(r.y * fy),
    width: Math.round(r.width * fx), height: Math.round(r.height * fy),
  });

  // --- transitions: compositor owns the trigger, design owns the target ----
  // Two exits can lead to the SAME place (rua-direita reaches A Famosa by the
  // west street and by the south gate), so pairing has to be one-to-one: match
  // each new trigger to the CLOSEST unclaimed old one, by rescaled centre.
  // Matching on "which side of the plate centre" instead put both of those on
  // the same prior entry, and the second one silently inherited the first's
  // label — two identically-named exits in the travel menu.
  const unclaimed = [...(old.transitions || [])];
  const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  const transitions = (derived.transitions || []).map((t) => {
    const c = centre(t.triggerArea);
    let bestIdx = -1;
    let bestD2 = Infinity;
    unclaimed.forEach((o, i) => {
      if (o.targetLocation !== t.targetLocation) return;
      const oc = centre(o.triggerArea);
      const dx = oc.x * fx - c.x;
      const dy = oc.y * fy - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    });
    const prior = bestIdx >= 0 ? unclaimed.splice(bestIdx, 1)[0] : null;
    const merged = {
      targetLocation: t.targetLocation,
      label: (prior && prior.label) || t.label,
      triggerArea: t.triggerArea,
      // spawnAt lands in the TARGET plate, which this rebuild does not touch —
      // so the prior file's value normally wins. When a whole BATCH of plates
      // is rebuilt together the targets do change underneath us, and then the
      // prior value is a stale coordinate in a plate size that no longer
      // exists; --spawn-derived hands the choice back to the layout.
      spawnAt: opts.spawnDerived
        ? (t.spawnAt || (prior && prior.spawnAt))
        : ((prior && prior.spawnAt) || t.spawnAt),
    };
    ['requirements', 'showWhenLocked', 'lockedLabel', 'blockedMessage'].forEach((k) => {
      if (prior && prior[k] !== undefined) merged[k] = prior[k];
    });
    return merged;
  });

  // --- lights / fires ------------------------------------------------------
  const lights = (derived.lights || []).map((l) => ({
    ...l,
    type: LIGHT_TYPE_MAP[l.type] || l.type,
  }));
  const fires = lights.filter((l) => l.type === 'cookingFire').map((l) => ({ x: l.x, y: l.y }));

  // An animated prop is a sway/flicker sprite drawn ON TOP of the thing the
  // plate already paints, so it may sit slightly off-frame — the compositor
  // legitimately puts a palm cluster or a laundry line half over the edge.
  // Past about a sprite width out there is nothing left on the plate for it to
  // animate, and it is just an invisible ticking tween.
  const ANIM_OFFPLATE_MARGIN = 24;
  const animatedProps = (derived.animatedProps || [])
    .filter((p) => {
      const on = p.x >= -ANIM_OFFPLATE_MARGIN && p.x <= nw + ANIM_OFFPLATE_MARGIN
        && p.y >= -ANIM_OFFPLATE_MARGIN && p.y <= nh + ANIM_OFFPLATE_MARGIN;
      if (!on) notes.push(`animatedProp "${p.type}" at (${p.x},${p.y}) is off the plate — dropped`);
      return on;
    })
    .map((p) => ({
      type: ANIM_TYPE_MAP[p.type] || p.type,
      x: Math.round(p.x),
      y: Math.round(p.y),
    }));

  // --- the merged document -------------------------------------------------
  const next = {
    id,
    name: old.name,
    // Bumped whenever a plate's coordinate space changes. Saves carrying an
    // older version snap the player back to spawns.player instead of dropping
    // them inside a building (see saveStore / GameScene.createPlayer).
    coordVersion: (old.coordVersion || 1) + 1,
    world: { scale: derived.world.scale, nativeWidth: nw, nativeHeight: nh },
    layoutHash: derived.layoutHash,
    generatedBy: derived.generatedBy,
    sun: derived.sun,
    plate: {
      background: backgroundKey,
      variants: old.plate.variants,
      runtimeMode: 'legacy-backdrop',
      // The camera scrolls wherever the world is bigger than the 960x540
      // viewport; CameraSystem derives this from world size, this field is the
      // authored intent (and what the validator checks the plate size against).
      camera: nw * derived.world.scale > 960 || nh * derived.world.scale > 540 ? 'scrolling' : 'fixed',
      walkMask: `${id}-walk`,
      targetMode: 'isometric-2:1',
      authoringBasis: 'forge-compositor',
      anchor: 'bottom-center',
      depthStrategy: 'screen-y',
      tileWidth: derived.iso.tileWidth,
      tileHeight: derived.iso.tileHeight,
    },
    collision: derived.collision,
    spawns: derived.spawns,
    npcs: derived.npcs,
    transitions,
    // Props are PAINTED INTO the plate by the compositor. They stay in the data
    // as examinable hotspots (label + examineText), never as sprites — drawing
    // them again would double-image every crate on the street.
    props: [],
    // Full-canvas painted fields (the sea, a canopy band, the distant sails)
    // have no anchor point — they are not a thing you can walk up to and
    // examine, so they are not hotspots and carry no coordinate.
    plateProps: (derived.props || [])
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .map((p) => ({
        ...p,
        type: p.type || (p.key || '').replace(new RegExp(`^${id}-`), ''),
      })),
    doors: derived.doors || [],
    overlays: derived.overlays || [],
    animatedProps,
    lights,
    fires,
    audio: old.audio,
    visual: {
      ...old.visual,
      sunAnchor: rescalePoint(old.visual.sunAnchor),
      aoZones: (old.visual.aoZones || []).map(scaleRect),
      canopyShadows: (old.visual.canopyShadows || []).map(scaleRect),
    },
    crowd: {
      maxCrowd: derived.crowd.maxActors || old.crowd.maxCrowd,
      density: old.crowd.density,
      crowdTypes: old.crowd.crowdTypes,
      // Polylines from the compositor, which routed them over walkable ground.
      paths: derived.crowd.paths.map((p) => ({
        id: p.id,
        speed: p.speed,
        points: p.points.map(([x, y]) => ({ x, y })),
      })),
    },
    items,
    loreObjects,
  };

  if (!opts.dry) {
    fs.writeFileSync(locFile, JSON.stringify(next, null, 2) + '\n');
  }

  return {
    id,
    notes,
    counts: {
      collisionRects: next.collision.rects.length,
      plateProps: next.plateProps.length,
      overlays: next.overlays.length,
      lights: next.lights.length,
      animatedProps: next.animatedProps.length,
      crowdPaths: next.crowd.paths.length,
      items: next.items.length,
      loreObjects: next.loreObjects.length,
    },
  };
}

module.exports = { install, snapToWalkable, readMask };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const spawnDerived = argv.includes('--spawn-derived');
  let from = null;
  const ids = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') { from = argv[++i]; continue; }
    if (argv[i].startsWith('--')) continue;
    ids.push(argv[i]);
  }
  if (!ids.length) {
    console.error('usage: node tools/forge/install-plate.cjs <location-id> [--dry] [--from <dir>] [--spawn-derived]');
    process.exit(1);
  }
  (async () => {
    for (const id of ids) {
      const r = await install(id, { dry, from, spawnDerived });
      console.log(`${r.id}${dry ? ' (dry run)' : ''}`);
      Object.entries(r.counts).forEach(([k, v]) => console.log(`  ${k.padEnd(16)} ${v}`));
      r.notes.forEach((n) => console.log(`  · ${n}`));
    }
    console.log('\nnext: npm run forge:relight');
  })().catch((e) => { console.error(e); process.exit(1); });
}
