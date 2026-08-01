#!/usr/bin/env node
/**
 * validate-location-data.cjs
 *
 * Guards the unified location data (`src/data/locations/<id>.location.json`) —
 * the coordinate-rot backstop the engine audit asked for. Runs in pretest and
 * prebuild, so a plate can never again be regenerated while lights, crowd paths
 * or lore objects silently drift off the canvas.
 *
 * Hard failures:
 *   - any coordinate outside the native plate (0..nativeWidth / 0..nativeHeight)
 *   - collision rects, trigger areas and shade zones that leave the canvas
 *   - spawns (player / NPC / transition spawnAt) inside a collision rect
 *   - prop / animated-prop sprite keys with no shipping asset
 *   - music, ambient and footstep audio keys with no shipping asset
 *   - transitions targeting an unknown location, or not paired bidirectionally
 *   - NPC ids not present in npcs.json
 *   - item ids not present in the inventory item definitions
 *   - lore object ids not present in historical-objects.json
 *
 * Warnings (non-fatal): audio keys that are authored intent but not produced
 * yet (transition SFX). The runtime guards these with `cache.audio.exists`.
 *
 * Usage: node tools/validate-location-data.cjs [--strict]
 *        --strict promotes warnings to failures.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOC_DIR = path.join(ROOT, 'src', 'data', 'locations');
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const locationFiles = fs.readdirSync(LOC_DIR).filter((f) => f.endsWith('.location.json'));
if (locationFiles.length === 0) {
  console.error('[validate-location-data] FAIL: no *.location.json files found');
  process.exit(1);
}

const locations = {};
for (const file of locationFiles) {
  const id = file.replace(/\.location\.json$/, '');
  locations[id] = readJSON(path.join(LOC_DIR, file));
}

const npcs = readJSON(path.join(ROOT, 'src', 'data', 'npcs.json'));
const npcIds = new Set(Object.keys(npcs.npcs || npcs));
const historical = readJSON(path.join(ROOT, 'src', 'data', 'historical-objects.json')).objects || {};
const loreIds = new Set(Object.keys(historical));
const manifest = readJSON(path.join(ROOT, 'src', 'data', 'runtime-asset-manifest.json'));

const staticObjectIds = new Set(manifest.objects.static || []);
const OBJECTS_DIR = path.join(ROOT, 'assets', 'sprites', 'objects');
const objectFiles = new Set(
  fs.existsSync(OBJECTS_DIR) ? fs.readdirSync(OBJECTS_DIR).map((f) => f.replace(/\.png$/, '')) : []
);

/** Animated props are driven by spritesheets registered in BootScene. */
const ANIMATED_PROP_SHEETS = {
  torch: 'torch-flame-sheet',
  'palm-sway': 'palm-frond-sheet',
  'awning-flutter': 'awning-flutter-sheet',
  smoke: 'smoke-sheet',
  seagull: 'seagull-sheet',
  flag: 'flag-sheet',
};

const MUSIC_DIR = path.join(ROOT, 'assets', 'audio', 'music');
const SFX_DIR = path.join(ROOT, 'assets', 'audio', 'sfx');
const audioKeys = new Set([
  ...(fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR) : []),
  ...(fs.existsSync(SFX_DIR) ? fs.readdirSync(SFX_DIR) : []),
].map((f) => f.replace(/\.(wav|ogg|mp3)$/, '')));

// Item definitions live in a TS store; read the ids out of it textually rather
// than adding a TS runtime to a plain node validator.
const inventorySrc = fs.readFileSync(
  path.join(ROOT, 'src', 'stores', 'inventoryStore.ts'), 'utf8');
const itemDefsBlock = inventorySrc.slice(inventorySrc.indexOf('ITEM_DEFINITIONS'));
const itemIds = new Set(
  [...itemDefsBlock.matchAll(/^\s{2}'([a-z0-9-]+)':\s*\{/gm)].map((m) => m[1])
);

// Crowd extras deliberately spawn/despawn just off the visible edge so they
// walk into frame. Anything further out is rotten data.
const CROWD_OFFSCREEN_MARGIN = 24;

// A lantern hung on the last house before the frame edge, or a lit window on a
// building the plate only shows half of, legitimately sits just off-plate: the
// pool it bakes is still mostly on-screen. Further out is a coordinate bug.
const LIGHT_OFFPLATE_MARGIN = 48;

/**
 * Same story for animated props: the sway sprite sits on the painted thing it
 * animates, and the compositor legitimately paints a palm cluster or a laundry
 * line half over the frame edge, so its anchor lands just outside. The sprites
 * are 16-32 native px, so an anchor further out than this is animating
 * something the plate does not show — i.e. coordinate rot, not composition.
 */
const ANIM_PROP_OFFPLATE_MARGIN = 24;

/**
 * Characters are positioned by their sprite ORIGIN, but they stand on their
 * feet: a 16x32 sprite at 3x contacts the ground ~44 world px (≈15 native px)
 * below its origin. GameScene samples the walk mask there, so the validator
 * must too — checking the origin instead passes spawns whose feet are inside a
 * wall, and the engine then quietly snaps them somewhere else.
 */
const CONTACT_OFFSET_NATIVE = 15;

const SCENES_DIR = path.join(ROOT, 'assets', 'scenes');
const MASKS_DIR = path.join(SCENES_DIR, 'masks');
const OVERLAYS_DIR = path.join(SCENES_DIR, 'overlays');
const TODS = ['dawn', 'dusk', 'night'];

/**
 * `plate.background` is a TEXTURE KEY that BootScene must have registered, and
 * for two locations it is NOT the filename ('scene-a-famosa-gate' loads
 * scenes/scene-a-famosa.png). A plate rebuild that "tidies" the key to match
 * the file leaves the runtime asking for a texture nobody loaded — and the
 * failure is a console.log and an unchanged backdrop, which reads as "the
 * plate did not update" rather than as an error. So the keys BootScene
 * registers are read out of it and checked here.
 */
const BOOT_SCENE = path.join(ROOT, 'src', 'phaser', 'scenes', 'BootScene.ts');
const bootSrc = fs.existsSync(BOOT_SCENE) ? fs.readFileSync(BOOT_SCENE, 'utf8') : '';
const mapBlock = bootSrc.slice(bootSrc.indexOf('const sceneMapping'));
const bootPlateKeys = new Map(
  [...mapBlock.slice(0, mapBlock.indexOf('};')).matchAll(/'([\w-]+)':\s*'scenes\/([\w-]+)\.png'/g)]
    .map((m) => [m[1], m[2]])
);

/**
 * Walk masks, lazily decoded. R>=128 means walkable; the mask is the
 * authoritative collision surface from Stage 3 onwards, so anything that is
 * supposed to stand on the ground is checked against it rather than against
 * the 8px-grid collision rects derived from it.
 */
const _masks = new Map();
function walkMaskFor(loc) {
  if (!loc.plate?.walkMask) return null;
  const key = loc.plate.walkMask;
  if (_masks.has(key)) return _masks.get(key);
  const file = path.join(MASKS_DIR, `${key}.png`);
  let mask = null;
  if (fs.existsSync(file)) {
    const { createCanvas, Image } = require('canvas');
    const img = new Image();
    img.src = fs.readFileSync(file);   // synchronous for a Buffer source
    const cv = createCanvas(img.width, img.height);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    mask = (x, y) => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) return false;
      return data[(py * img.width + px) * 4] >= 128;
    };
  }
  _masks.set(key, mask);
  return mask;
}

/** PNG IHDR is at a fixed offset — cheaper than pulling in node-canvas here. */
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(24);
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

for (const [id, loc] of Object.entries(locations)) {
  const where = (what) => `${id}: ${what}`;
  const W = loc.world?.nativeWidth;
  const H = loc.world?.nativeHeight;

  if (typeof W !== 'number' || typeof H !== 'number' || typeof loc.world.scale !== 'number') {
    fail(where('world.scale / nativeWidth / nativeHeight must all be numbers'));
    continue;
  }
  if (loc.id !== id) fail(where(`id field "${loc.id}" does not match filename`));

  const inBounds = (x, y, margin = 0) =>
    x >= -margin && x <= W + margin && y >= -margin && y <= H + margin;

  const checkPoint = (what, p, margin = 0) => {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') {
      fail(where(`${what}: not a {x,y} point`));
      return false;
    }
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      fail(where(`${what}: non-finite coordinate (${p.x}, ${p.y})`));
      return false;
    }
    if (!inBounds(p.x, p.y, margin)) {
      fail(where(`${what}: (${p.x}, ${p.y}) is outside the native ${W}x${H} plate`));
      return false;
    }
    return true;
  };

  const checkRect = (what, r) => {
    if (!r || ['x', 'y', 'width', 'height'].some((k) => typeof r[k] !== 'number')) {
      fail(where(`${what}: not a {x,y,width,height} rect`));
      return false;
    }
    if (r.width <= 0 || r.height <= 0) {
      fail(where(`${what}: non-positive size (${r.width}x${r.height})`));
      return false;
    }
    if (r.x < 0 || r.y < 0 || r.x + r.width > W || r.y + r.height > H) {
      fail(where(
        `${what}: rect ${r.x},${r.y} ${r.width}x${r.height} leaves the native ${W}x${H} plate`));
      return false;
    }
    return true;
  };

  // --- collision ----------------------------------------------------------
  const rects = loc.collision?.rects || [];
  rects.forEach((r, i) => checkRect(`collision.rects[${i}]`, r));

  const insideCollision = (p) =>
    rects.some((r) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height);

  const mask = walkMaskFor(loc);

  const checkSpawn = (what, p) => {
    if (!checkPoint(what, p)) return;
    if (mask) {
      // With a walk mask the rects are a derived approximation, so the mask is
      // what decides — a spawn that is not on walkable ground is a body stuck
      // in a wall on arrival.
      if (!mask(p.x, p.y + CONTACT_OFFSET_NATIVE)) {
        fail(where(`${what}: feet at (${p.x}, ${p.y + CONTACT_OFFSET_NATIVE}) are not on walkable ground in the walk mask`));
      }
    } else if (insideCollision(p)) {
      fail(where(`${what}: spawn (${p.x}, ${p.y}) sits inside a collision rect`));
    }
  };

  // --- spawns -------------------------------------------------------------
  checkSpawn('spawns.player', loc.spawns?.player);

  for (const [npcId, p] of Object.entries(loc.npcs || {})) {
    if (!npcIds.has(npcId)) fail(where(`npcs.${npcId}: no such npc in npcs.json`));
    checkSpawn(`npcs.${npcId}`, p);
  }

  // --- transitions --------------------------------------------------------
  (loc.transitions || []).forEach((t, i) => {
    const label = `transitions[${i}] -> ${t.targetLocation}`;
    if (!locations[t.targetLocation]) {
      fail(where(`${label}: unknown target location`));
    }
    checkRect(`${label}.triggerArea`, t.triggerArea);
    // spawnAt lands in the TARGET location, so validate it against that plate.
    const target = locations[t.targetLocation];
    if (target) {
      const tw = target.world.nativeWidth;
      const th = target.world.nativeHeight;
      const sp = t.spawnAt;
      if (!sp || typeof sp.x !== 'number' || typeof sp.y !== 'number') {
        fail(where(`${label}.spawnAt: not a {x,y} point`));
      } else if (sp.x < 0 || sp.x > tw || sp.y < 0 || sp.y > th) {
        fail(where(
          `${label}.spawnAt: (${sp.x}, ${sp.y}) is outside ${t.targetLocation}'s ${tw}x${th} plate`));
      } else {
        const targetMask = walkMaskFor(target);
        if (targetMask) {
          if (!targetMask(sp.x, sp.y + CONTACT_OFFSET_NATIVE)) {
            fail(where(`${label}.spawnAt: feet at (${sp.x}, ${sp.y + CONTACT_OFFSET_NATIVE}) are not on walkable ground in ${t.targetLocation}'s walk mask ` +
              '(a plate rebuild that changes the native size leaves every INBOUND spawn stale — rescale them)'));
          }
        } else {
          const targetRects = target.collision?.rects || [];
          const blocked = targetRects.some(
            (r) => sp.x >= r.x && sp.x <= r.x + r.width && sp.y >= r.y && sp.y <= r.y + r.height);
          if (blocked) {
            fail(where(`${label}.spawnAt: (${sp.x}, ${sp.y}) lands inside a collision rect in ${t.targetLocation}`));
          }
        }
      }
      // Bidirectional pairing.
      const back = (target.transitions || []).some((bt) => bt.targetLocation === id);
      if (!back) {
        fail(where(`${label}: ${t.targetLocation} has no transition back to ${id} (one-way exit)`));
      }
    }
  });

  // --- props --------------------------------------------------------------
  (loc.props || []).forEach((p, i) => {
    checkPoint(`props[${i}] (${p.sprite})`, p);
    if (!staticObjectIds.has(p.sprite) && !objectFiles.has(p.sprite)) {
      fail(where(`props[${i}]: sprite "${p.sprite}" has no asset in assets/sprites/objects/`));
    }
  });

  (loc.animatedProps || []).forEach((p, i) => {
    checkPoint(`animatedProps[${i}] (${p.type})`, p, ANIM_PROP_OFFPLATE_MARGIN);
    const sheet = ANIMATED_PROP_SHEETS[p.type];
    if (!sheet) {
      fail(where(`animatedProps[${i}]: unknown type "${p.type}"`));
    } else if (!objectFiles.has(sheet)) {
      fail(where(`animatedProps[${i}]: sheet "${sheet}.png" missing from assets/sprites/objects/`));
    }
  });

  // --- lights / fires -----------------------------------------------------
  const LIGHT_TYPES = new Set(['torch', 'lantern', 'cookingFire', 'window']);
  (loc.lights || []).forEach((l, i) => {
    checkPoint(`lights[${i}] (${l.type})`, l, LIGHT_OFFPLATE_MARGIN);
    if (!LIGHT_TYPES.has(l.type)) fail(where(`lights[${i}]: unknown light type "${l.type}"`));
  });
  (loc.fires || []).forEach((f, i) => checkPoint(`fires[${i}]`, f));

  // --- plate texture keys -------------------------------------------------
  if (bootPlateKeys.size > 0) {
    const bg = loc.plate?.background;
    const stem = bootPlateKeys.get(bg);
    if (!bg) {
      fail(where('plate.background: missing'));
    } else if (!stem) {
      fail(where(`plate.background: "${bg}" is not a key BootScene registers ` +
        `(sceneMapping has ${[...bootPlateKeys.keys()].join(', ')}) — the day plate would never load`));
    } else {
      // The variants must be derived from the SAME file stem the key resolves
      // to, because relight-plates.cjs writes day and variants together.
      Object.entries(loc.plate.variants || {}).forEach(([tod, key]) => {
        if (key !== `${stem}-${tod}`) {
          fail(where(`plate.variants.${tod}: "${key}" does not match the day plate's file stem ` +
            `("${stem}") — day and its variants would come from different masters`));
        }
      });
      const dayFile = path.join(SCENES_DIR, `${stem}.png`);
      if (!fs.existsSync(dayFile)) {
        fail(where(`plate.background: no day plate at assets/scenes/${stem}.png`));
      } else {
        const { width, height } = pngSize(dayFile);
        if (width !== W * loc.world.scale || height !== H * loc.world.scale) {
          fail(where(`plate.background: assets/scenes/${stem}.png is ${width}x${height}, ` +
            `expected ${W * loc.world.scale}x${H * loc.world.scale} — stale plate, run \`npm run forge:relight\``));
        }
      }
    }
  }

  // --- walk mask (Stage 3+: the authoritative collision surface) ----------
  if (loc.plate?.walkMask) {
    const maskFile = path.join(MASKS_DIR, `${loc.plate.walkMask}.png`);
    if (!fs.existsSync(maskFile)) {
      fail(where(`plate.walkMask: no mask at assets/scenes/masks/${loc.plate.walkMask}.png`));
    } else {
      const { width, height } = pngSize(maskFile);
      if (width !== W || height !== H) {
        fail(where(`plate.walkMask: mask is ${width}x${height}, must match the native ${W}x${H} plate`));
      }
    }
  }

  // --- foreground overlays (walk-behind occluders) ------------------------
  (loc.overlays || []).forEach((o, i) => {
    const label = `overlays[${i}] (${o.key})`;
    if (!o.key) { fail(where(`${label}: missing key`)); return; }
    checkRect(label, { x: o.x, y: o.y, width: o.width, height: o.height });
    if (typeof o.depthY !== 'number') fail(where(`${label}: depthY must be a number`));
    ['', ...TODS.map((t) => `-${t}`)].forEach((suffix) => {
      const file = path.join(OVERLAYS_DIR, `${o.key}${suffix}.png`);
      if (!fs.existsSync(file)) {
        fail(where(`${label}: missing assets/scenes/overlays/${o.key}${suffix}.png — run \`npm run forge:relight\``));
        return;
      }
      const { width, height } = pngSize(file);
      const s = loc.world.scale;
      if (width !== o.width * s || height !== o.height * s) {
        fail(where(`${label}: ${o.key}${suffix}.png is ${width}x${height}, expected ${o.width * s}x${o.height * s}`));
      }
    });
  });

  // --- plate props (painted into the plate; data is examine text only) ----
  // A prop whose ANCHOR is just off-frame still paints into the plate (the
  // street continues past the edge), so these carry a margin the on-plate
  // coordinates do not. Anything further out is coordinate rot.
  (loc.plateProps || []).forEach((p, i) => {
    checkPoint(`plateProps[${i}] (${p.key})`, p, 96);
    if (!p.key) fail(where(`plateProps[${i}]: missing key`));
  });

  if (loc.coordVersion !== undefined && typeof loc.coordVersion !== 'number') {
    fail(where('coordVersion must be a number'));
  }

  // --- crowd --------------------------------------------------------------
  const crowd = loc.crowd || {};
  (crowd.paths || []).forEach((p, i) => {
    // Two authoring forms: the pre-Stage-3 straight start/end run, and the
    // compositor's polyline, which is routed over walkable ground.
    if (Array.isArray(p.points)) {
      if (p.points.length < 2) fail(where(`crowd.paths[${i}]: polyline needs at least 2 points`));
      p.points.forEach((pt, j) => checkPoint(`crowd.paths[${i}].points[${j}]`, pt, CROWD_OFFSCREEN_MARGIN));
    } else {
      checkPoint(`crowd.paths[${i}].start`, p.start, CROWD_OFFSCREEN_MARGIN);
      checkPoint(`crowd.paths[${i}].end`, p.end, CROWD_OFFSCREEN_MARGIN);
    }
  });
  if (!crowd.paths || crowd.paths.length === 0) {
    fail(where('crowd.paths is empty — the city reads deserted'));
  }
  if (!crowd.crowdTypes || crowd.crowdTypes.length === 0) {
    fail(where('crowd.crowdTypes is empty'));
  }

  // --- audio --------------------------------------------------------------
  const audio = loc.audio || {};
  const requireAudio = (what, key) => {
    if (!key) { fail(where(`${what}: missing audio key`)); return; }
    if (!audioKeys.has(key)) fail(where(`${what}: audio "${key}" has no file in assets/audio/`));
  };
  requireAudio('audio.music', audio.music);
  requireAudio('audio.nightMusic', audio.nightMusic);
  (audio.ambientSounds || []).forEach((a, i) => requireAudio(`audio.ambientSounds[${i}]`, a.key));
  (audio.nightAmbientSounds || []).forEach((a, i) => requireAudio(`audio.nightAmbientSounds[${i}]`, a.key));
  if (!['stone', 'wood', 'dirt'].includes(audio.footstepSurface)) {
    fail(where(`audio.footstepSurface: "${audio.footstepSurface}" is not stone|wood|dirt`));
  }
  if (audio.transitionSound && !audioKeys.has(audio.transitionSound)) {
    // Authored intent for Stage 6 audio production; guarded at runtime by
    // Phaser's cache.audio.exists() check, so this is not a hard failure.
    warn(where(`audio.transitionSound "${audio.transitionSound}" is not produced yet`));
  }

  // --- visual -------------------------------------------------------------
  const visual = loc.visual || {};
  checkPoint('visual.sunAnchor', visual.sunAnchor);
  (visual.aoZones || []).forEach((z, i) => checkRect(`visual.aoZones[${i}]`, z));
  (visual.canopyShadows || []).forEach((z, i) => {
    // Canopy shadows are deliberately authored to bleed off the frame edges.
    if (['x', 'y', 'width', 'height'].some((k) => typeof z[k] !== 'number')) {
      fail(where(`visual.canopyShadows[${i}]: not a rect`));
    } else if (z.x < -W || z.y < -H || z.x > W || z.y > H) {
      fail(where(`visual.canopyShadows[${i}]: entirely off the plate`));
    }
  });
  if (!Array.isArray(visual.transitionTint) || visual.transitionTint.length !== 3) {
    fail(where('visual.transitionTint must be an [r,g,b] triple'));
  }

  // --- items --------------------------------------------------------------
  (loc.items || []).forEach((it, i) => {
    checkSpawn(`items[${i}] (${it.id})`, it);
    if (itemIds.size > 0 && !itemIds.has(it.itemId)) {
      fail(where(`items[${i}]: itemId "${it.itemId}" has no ITEM_DEFINITIONS entry`));
    }
  });

  // --- lore objects -------------------------------------------------------
  (loc.loreObjects || []).forEach((o, i) => {
    checkPoint(`loreObjects[${i}] (${o.id})`, o);
    if (!loreIds.has(o.id)) {
      fail(where(`loreObjects[${i}]: "${o.id}" not found in historical-objects.json`));
    }
    const source = historical[o.id];
    if (source && source.location !== id) {
      fail(where(`loreObjects[${i}]: "${o.id}" belongs to "${source.location}" in historical-objects.json`));
    }
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const locationCount = Object.keys(locations).length;

for (const w of warnings) console.warn(`[validate-location-data] WARN  ${w}`);
for (const e of errors) console.error(`[validate-location-data] ERROR ${e}`);

if (errors.length || (STRICT && warnings.length)) {
  console.error(
    `\n[validate-location-data] FAILED — ${errors.length} error(s), ${warnings.length} warning(s) across ${locationCount} locations`);
  process.exit(1);
}

console.log(
  `[validate-location-data] OK — ${locationCount} locations, ${warnings.length} warning(s)`);
