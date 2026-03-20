#!/usr/bin/env node
/**
 * Character Sprite Sheet Generator v2
 *
 * Generates 64x128 sprite sheets (4 cols x 4 rows of 16x32 frames)
 * matching BootScene.ts expectations:
 *   Row 0 = down (front), Row 1 = left, Row 2 = right, Row 3 = up (back)
 *   4 walk-cycle frames per direction
 *
 * Each character is drawn at 24x48 using Ultima 8 palette, then
 * scaled nearest-neighbor to 16x32 per frame.
 *
 * Usage: node tools/generate-character-sheets-v2.cjs [character-name]
 *        (no args = all characters)
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE } = require('./ultima8-graphics/palette.cjs');
const {
  CHAR_WIDTH,
  CHAR_HEIGHT,
  CHARACTER_META,
  addShadowOutline,
  addGroundShadow,
} = require('./ultima8-graphics/characters.cjs');

const FRAME_W = 16;
const FRAME_H = 32;
const COLS = 4; // frames per direction
const ROWS = 4; // directions: down, left, right, up
const SHEET_W = FRAME_W * COLS; // 64
const SHEET_H = FRAME_H * ROWS; // 128
const SRC_W = CHAR_WIDTH;  // 24
const SRC_H = CHAR_HEIGHT; // 48

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

// Walk animation parameters
const STRIDE_Y = [0, 2, 0, -2]; // leg offset per frame (pixels in 24x48 space)
const BOB_Y = [0, -1, 0, -1];   // body vertical bob
const STRIDE_X = [0, 1, 0, -1]; // horizontal leg spread for stride width illusion

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Draw front-facing character to a 24x48 canvas
 */
function drawFront(drawFunc) {
  const canvas = createCanvas(SRC_W, SRC_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, SRC_W, SRC_H);
  drawFunc(ctx);

  // Post-processing: shadow outline + ground shadow
  if (addShadowOutline) addShadowOutline(ctx);
  if (addGroundShadow) addGroundShadow(ctx);

  return canvas;
}

/**
 * Get RGBA pixel data from a canvas
 */
function getPixels(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function setPixelRGBA(imageData, x, y, r, g, b, a) {
  if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
  const i = (y * imageData.width + x) * 4;
  imageData.data[i] = r;
  imageData.data[i + 1] = g;
  imageData.data[i + 2] = b;
  imageData.data[i + 3] = a;
}

function getPixelRGBA(imageData, x, y) {
  if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
    return [0, 0, 0, 0];
  }
  const i = (y * imageData.width + x) * 4;
  return [
    imageData.data[i],
    imageData.data[i + 1],
    imageData.data[i + 2],
    imageData.data[i + 3],
  ];
}

function hexToRGB(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

/**
 * Create back-view from front canvas.
 * - Darkens entire sprite ~15% (back is in shadow from top-left lighting)
 * - Wider hair overpaint covering ears and neck
 * - Hair extends below headBottom
 * - Character-specific details: helmet characters keep helmet, robed characters get center seam
 */
function createBackView(frontCanvas, meta) {
  const canvas = createCanvas(SRC_W, SRC_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Copy front image
  ctx.drawImage(frontCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, SRC_W, SRC_H);

  // Step 1: Darken entire sprite by ~15% (back is in shadow)
  for (let y = 0; y < SRC_H; y++) {
    for (let x = 0; x < SRC_W; x++) {
      const [r, g, b, a] = getPixelRGBA(imgData, x, y);
      if (a > 128) {
        setPixelRGBA(imgData, x, y,
          Math.round(r * 0.85), Math.round(g * 0.85), Math.round(b * 0.85), a);
      }
    }
  }

  const hairMid = hexToRGB(meta.hairColor[3]);
  const hairDark = hexToRGB(meta.hairColor[2]);
  const hairLight = hexToRGB(meta.hairColor[5]);

  // Step 2: Overpaint face area with hair/back of head
  // For helmeted characters (Capitao), skip the hair overpaint on the head region — keep helmet visible
  if (!meta.hasHelmet) {
    // Wider overpaint area: faceLeft-2 to faceRight+2 for full coverage (ears, neck)
    const overLeft = meta.faceLeft - 2;
    const overRight = meta.faceRight + 2;
    // Extend hair 3 rows below headBottom for neck/hair coverage
    const overBottom = meta.headBottom + 3;

    for (let y = meta.headTop; y <= overBottom; y++) {
      for (let x = overLeft; x <= overRight; x++) {
        const [, , , a] = getPixelRGBA(imgData, x, y);
        if (a > 128) {
          let c;
          if (x < overLeft + 2) c = hairLight;
          else if (x > overRight - 2) c = hairDark;
          else c = hairMid;
          setPixelRGBA(imgData, x, y, c[0], c[1], c[2], 255);
        }
      }
    }
  }

  // Step 3: Aggressively replace any remaining skin pixels near the head with hair
  // Wider detection area: faceLeft-3 to faceRight+3
  const skinDetectLeft = meta.faceLeft - 3;
  const skinDetectRight = meta.faceRight + 3;
  const skinDetectBottom = meta.headBottom + 3;

  for (let y = meta.headTop; y <= skinDetectBottom; y++) {
    for (let x = skinDetectLeft; x <= skinDetectRight; x++) {
      const [r, g, b, a] = getPixelRGBA(imgData, x, y);
      if (a > 128) {
        const skinRef = hexToRGB(meta.skinColor[4]);
        const dist = Math.abs(r - skinRef[0]) + Math.abs(g - skinRef[1]) + Math.abs(b - skinRef[2]);
        // More aggressive threshold for skin detection
        if (dist < 100) {
          setPixelRGBA(imgData, x, y, hairMid[0], hairMid[1], hairMid[2], 255);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Step 4: Center seam line on clothing (back detail)
  if (meta.hasLongRobe) {
    // Robed characters: seam extends through the entire robe using mainCloth shade 2
    for (let y = meta.headBottom + 3; y < SRC_H; y++) {
      const checkData = ctx.getImageData(11, y, 1, 1);
      if (checkData.data[3] > 128) {
        ctx.fillStyle = meta.mainCloth[2];
        ctx.fillRect(11, y, 1, 1);
        ctx.fillRect(12, y, 1, 1);
      }
    }
  } else {
    // Non-robed characters: seam only on torso area
    for (let y = meta.headBottom + 3; y < meta.legTop; y++) {
      const checkData = ctx.getImageData(11, y, 1, 1);
      if (checkData.data[3] > 128) {
        ctx.fillStyle = meta.mainCloth[2];
        ctx.fillRect(11, y, 1, 1);
        ctx.fillRect(12, y, 1, 1);
      }
    }
  }

  return canvas;
}

/**
 * Create left-facing profile using asymmetric body remap.
 * Near side (facing viewer, left) is wider; far side is foreshortened and darker.
 * Head shifted toward facing direction. Single eye at front, protruding nose.
 */
function createLeftProfile(frontCanvas, meta) {
  const canvas = createCanvas(SRC_W, SRC_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const srcData = getPixels(frontCanvas);
  const dstData = ctx.createImageData(SRC_W, SRC_H);

  // For each row, remap x-coordinates asymmetrically
  for (let y = 0; y < SRC_H; y++) {
    // Determine body width at this row from source data
    let srcLeft = SRC_W, srcRight = -1;
    for (let x = 0; x < SRC_W; x++) {
      const [, , , a] = getPixelRGBA(srcData, x, y);
      if (a > 128) {
        if (x < srcLeft) srcLeft = x;
        if (x > srcRight) srcRight = x;
      }
    }
    if (srcRight < srcLeft) continue; // empty row

    const srcWidth = srcRight - srcLeft + 1;
    const isHead = y >= meta.headTop && y <= meta.headBottom;

    // Compressed width: narrower than front view (head slightly wider for rounder profile)
    const compressedWidth = Math.max(3, Math.round(srcWidth * (isHead ? 0.72 : 0.65)));

    // Shift toward facing direction (left): head shifts more
    const headShift = isHead ? -2 : -1;
    const dstLeft = srcLeft + headShift;

    // Map source pixels to destination with asymmetric compression
    // Near side (left, facing viewer) gets more destination pixels
    for (let dp = 0; dp < compressedWidth; dp++) {
      const t = dp / compressedWidth;
      // Asymmetric mapping: near 40% of source mapped to 45% of dest,
      // far 60% of source compressed into 55% of dest
      let srcT;
      if (t < 0.45) {
        srcT = t / 0.45 * 0.4;
      } else {
        srcT = 0.4 + (t - 0.45) / 0.55 * 0.6;
      }
      const srcX = srcLeft + Math.round(srcT * (srcWidth - 1));
      const dstX = dstLeft + dp;

      const [r, g, b, a] = getPixelRGBA(srcData, srcX, y);
      if (a > 128) {
        // Darken far side slightly for depth
        const darken = t > 0.7 ? 0.85 : 1.0;
        setPixelRGBA(dstData, dstX, y,
          Math.round(r * darken), Math.round(g * darken), Math.round(b * darken), a);
      }
    }
  }

  ctx.putImageData(dstData, 0, 0);

  // Ear bump on far side of profile head
  const earY = Math.round((meta.headTop + meta.headBottom) * 0.48);
  ctx.fillStyle = meta.skinColor[3];
  ctx.fillRect(meta.faceRight - 2, earY, 1, 2);

  // Jawline shadow on far side
  ctx.fillStyle = meta.skinColor[1];
  ctx.fillRect(meta.faceRight - 2, meta.headBottom - 2, 1, 2);

  // Profile nose protruding 2px with bridge shading
  const noseY = Math.round((meta.headTop + meta.headBottom) * 0.55);
  ctx.fillStyle = meta.skinColor[5]; // bridge highlight
  ctx.fillRect(meta.faceLeft - 3, noseY, 1, 1);
  ctx.fillStyle = meta.skinColor[4]; // nose tip
  ctx.fillRect(meta.faceLeft - 4, noseY, 1, 1);
  ctx.fillStyle = meta.skinColor[3]; // underside shadow
  ctx.fillRect(meta.faceLeft - 3, noseY + 1, 1, 1);

  // Single visible eye at front of head
  ctx.fillStyle = '#000000';
  ctx.fillRect(meta.faceLeft - 1, noseY - 1, 1, 1);

  return canvas;
}

/**
 * Create right-facing profile by mirroring the left profile
 */
function createRightProfile(frontCanvas, meta) {
  const leftCanvas = createLeftProfile(frontCanvas, meta);
  const canvas = createCanvas(SRC_W, SRC_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Horizontal flip
  ctx.translate(SRC_W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(leftCanvas, 0, 0);

  return canvas;
}

/**
 * Apply walk frame to a directional canvas.
 * Returns a new canvas with leg offsets, body bob, and stride width applied.
 * - Robed characters: skip leg animation, use horizontal hem sway instead
 * - Non-robed characters: horizontal leg offset + arm counter-swing
 */
function applyWalkFrame(srcCanvas, meta, frame) {
  const canvas = createCanvas(SRC_W, SRC_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const stride = STRIDE_Y[frame];
  const strideX = STRIDE_X[frame];
  const bob = BOB_Y[frame];

  if (stride === 0 && bob === 0 && strideX === 0) {
    ctx.drawImage(srcCanvas, 0, 0);
    return canvas;
  }

  const srcData = getPixels(srcCanvas);
  const dstData = ctx.createImageData(SRC_W, SRC_H);

  for (let y = 0; y < SRC_H; y++) {
    for (let x = 0; x < SRC_W; x++) {
      const [r, g, b, a] = getPixelRGBA(srcData, x, y);
      if (a < 10) continue;

      if (meta.hasLongRobe && y >= meta.legTop) {
        // Robed characters: sway bottom hem horizontally instead of leg animation
        // Sway increases toward bottom of robe
        const robeProgress = (y - meta.legTop) / (SRC_H - meta.legTop);
        const swayAmount = Math.round(strideX * robeProgress);
        const destX = x + swayAmount;
        const destY = y;
        if (destX >= 0 && destX < SRC_W && destY >= 0 && destY < SRC_H) {
          setPixelRGBA(dstData, destX, destY, r, g, b, a);
        }
      } else if (y >= meta.legTop) {
        // Non-robed: leg region with both vertical stride and horizontal spread
        const isLeftLeg = x <= meta.legSplit;
        const legStrideY = isLeftLeg ? stride : -stride;
        const legStrideX = isLeftLeg ? strideX : -strideX;
        const destX = x + legStrideX;
        const destY = y + legStrideY;
        if (destX >= 0 && destX < SRC_W && destY >= 0 && destY < SRC_H) {
          setPixelRGBA(dstData, destX, destY, r, g, b, a);
        }
      } else {
        // Upper body region
        const isArm = !meta.hasLongRobe &&
          (x <= meta.faceLeft - 3 || x >= meta.faceRight + 3);

        if (isArm) {
          // Arms: counter-swing (opposite bob) for natural walk motion
          const armBob = -bob;
          const destY = y + armBob;
          if (destY >= 0 && destY < SRC_H) {
            setPixelRGBA(dstData, x, destY, r, g, b, a);
          }
        } else {
          // Core upper body: apply normal bob
          const destY = y + bob;
          if (destY >= 0 && destY < SRC_H) {
            setPixelRGBA(dstData, x, destY, r, g, b, a);
          }
        }
      }
    }
  }

  ctx.putImageData(dstData, 0, 0);
  return canvas;
}

/**
 * Scale 24x48 canvas down to 16x32 (nearest-neighbor)
 */
function scaleDown(srcCanvas) {
  const canvas = createCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, SRC_W, SRC_H, 0, 0, FRAME_W, FRAME_H);
  return canvas;
}

/**
 * Generate a complete sprite sheet for one character
 */
function generateSheet(name, meta) {
  const sheet = createCanvas(SHEET_W, SHEET_H);
  const sheetCtx = sheet.getContext('2d');
  sheetCtx.imageSmoothingEnabled = false;
  sheetCtx.clearRect(0, 0, SHEET_W, SHEET_H);

  // Draw base front-facing sprite
  const frontCanvas = drawFront(meta.drawFunc);

  // Create directional variants
  const directions = [
    frontCanvas,                            // row 0: down (front)
    createLeftProfile(frontCanvas, meta),    // row 1: left
    createRightProfile(frontCanvas, meta),   // row 2: right
    createBackView(frontCanvas, meta),       // row 3: up (back)
  ];

  // Draw each direction x frame
  for (let row = 0; row < ROWS; row++) {
    const dirCanvas = directions[row];
    for (let col = 0; col < COLS; col++) {
      const frameCanvas = applyWalkFrame(dirCanvas, meta, col);
      const scaled = scaleDown(frameCanvas);
      sheetCtx.drawImage(scaled, col * FRAME_W, row * FRAME_H);
    }
  }

  return sheet;
}

/**
 * Generate a single static sprite (frame 0, down direction)
 */
function generateStatic(meta) {
  const frontCanvas = drawFront(meta.drawFunc);
  return scaleDown(frontCanvas);
}

function main() {
  ensureDir(OUT_DIR);

  const requestedChars = process.argv.length > 2
    ? process.argv.slice(2)
    : Object.keys(CHARACTER_META);

  console.log('Generating character sprite sheets v2...');
  console.log('  Output: ' + OUT_DIR);
  console.log('  Sheet size: ' + SHEET_W + 'x' + SHEET_H + ' (' + COLS + ' cols x ' + ROWS + ' rows of ' + FRAME_W + 'x' + FRAME_H + ')');
  console.log('  Characters: ' + requestedChars.join(', ') + '\n');

  let generated = 0;

  for (const name of requestedChars) {
    const meta = CHARACTER_META[name];
    if (!meta) {
      console.log('  SKIP: ' + name + ' -- no metadata found');
      continue;
    }

    // Generate sprite sheet
    const sheet = generateSheet(name, meta);
    const sheetPath = path.join(OUT_DIR, name + '-sheet.png');
    fs.writeFileSync(sheetPath, sheet.toBuffer('image/png'));
    console.log('  OK: ' + name + '-sheet.png (' + SHEET_W + 'x' + SHEET_H + ')');

    // Generate static sprite (front-facing, frame 0)
    const staticSprite = generateStatic(meta);
    const staticPath = path.join(OUT_DIR, name + '.png');
    fs.writeFileSync(staticPath, staticSprite.toBuffer('image/png'));
    console.log('  OK: ' + name + '.png (' + FRAME_W + 'x' + FRAME_H + ')');

    generated++;
  }

  // Also generate fallback NPC sprite
  if (requestedChars.includes('aminah') || requestedChars.length === Object.keys(CHARACTER_META).length) {
    const npcMeta = CHARACTER_META['aminah'];
    const npcStatic = generateStatic(npcMeta);
    const npcPath = path.join(OUT_DIR, 'npc.png');
    fs.writeFileSync(npcPath, npcStatic.toBuffer('image/png'));
    console.log('  OK: npc.png (fallback)');
  }

  console.log('\nDone! Generated ' + generated + ' character sprite sheets.');
}

main();
