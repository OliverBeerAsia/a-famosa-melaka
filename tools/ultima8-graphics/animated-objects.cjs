/**
 * Animated Object Sprite Sheet Generator
 * Creates multi-frame horizontal sprite sheets for animated environmental objects.
 * Each sheet is a horizontal strip of frames (side by side).
 *
 * Run: node tools/ultima8-graphics/animated-objects.cjs
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE } = require('./palette.cjs');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites', 'objects');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function saveSheet(canvas, name) {
  const buffer = canvas.toBuffer('image/png');
  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(path.join(OUTPUT_DIR, name), buffer);
  console.log(`  \u2713 ${name}`);
}

/**
 * Deterministic pseudo-random based on position and seed.
 * Returns a value in [0, 1).
 */
function seededRandom(x, y, seed) {
  let h = (x * 374761 + y * 668265 + seed * 982451) & 0x7fffffff;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return (h & 0xffff) / 0x10000;
}

// ---------------------------------------------------------------------------
// 1. Torch flame — 4 frames, 8x16 each => 32x16
// ---------------------------------------------------------------------------
function generateTorchFlame() {
  const frameW = 8;
  const frameH = 16;
  const frames = 4;
  const canvas = createCanvas(frameW * frames, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const fire = PALETTE.fire;
  const wood = PALETTE.wood;

  // Lateral offsets for the flame tip per frame
  const tipOffsets = [0, 1, 0, -1];
  // Ember positions per frame (deterministic, different each frame)
  const emberPositions = [
    { x: 2, y: 3 },
    { x: 5, y: 2 },
    { x: 1, y: 4 },
    { x: 6, y: 1 },
  ];

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW; // frame x-offset in the sheet
    const tipOff = tipOffsets[f];

    // --- Torch handle (static, bottom 6 rows: y 10-15) ---
    // 2px wide brown wood pole, centered at x=3,4
    for (let y = 10; y < 16; y++) {
      setPixel(ctx, ox + 3, y, wood[4]); // mid
      setPixel(ctx, ox + 4, y, wood[3]); // dark side
    }

    // --- Flame body (y 2-9) ---
    // Base of flame is wider, narrows toward tip
    for (let y = 2; y <= 9; y++) {
      const t = (y - 2) / 7; // 0 at top, 1 at bottom
      // Width narrows toward top
      const halfWidth = Math.floor(1 + t * 1.5);
      const cx = 3 + (t < 0.3 ? tipOff : 0); // tip shifts laterally

      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= frameW) continue;

        // Color: tips (top rows) use fire[5-7], base uses fire[3-4]
        let colorIdx;
        if (t < 0.3) {
          // Tip — bright yellows/oranges
          colorIdx = 5 + Math.floor((1 - t / 0.3) * 2); // 7 -> 5
        } else {
          // Base — deeper orange/red
          colorIdx = 3 + Math.floor((1 - t) * 1.5); // 3-4
        }
        colorIdx = Math.max(0, Math.min(7, colorIdx));
        setPixel(ctx, ox + px, y, fire[colorIdx]);
      }
    }

    // --- Random ember pixel (1-2 per frame, deterministic) ---
    const ember = emberPositions[f];
    if (ember.x >= 0 && ember.x < frameW && ember.y >= 0 && ember.y < frameH) {
      setPixel(ctx, ox + ember.x, ember.y, fire[6]);
    }
    // Second ember at a different spot
    const ember2x = (ember.x + 3) % frameW;
    const ember2y = Math.max(0, ember.y + 2);
    if (ember2y < 10) {
      setPixel(ctx, ox + ember2x, ember2y, fire[5]);
    }
  }

  saveSheet(canvas, 'torch-flame-sheet.png');
}

// ---------------------------------------------------------------------------
// 2. Palm frond sway — 3 frames, 16x48 each => 48x48
// ---------------------------------------------------------------------------
function generatePalmFrondSway() {
  const frameW = 16;
  const frameH = 48;
  const frames = 3;
  const canvas = createCanvas(frameW * frames, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const trunk = PALETTE.wood;
  const leaves = PALETTE.jungle;

  // Crown shift per frame: left(-1), neutral(0), right(+1)
  const crownShifts = [-1, 0, 1];

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW;
    const shift = crownShifts[f];

    // --- Trunk (bottom 28 rows, y 20-47) — static ---
    for (let y = 20; y < 48; y++) {
      const wobble = Math.sin(y * 0.3) * 0.5;
      const cx = 8 + Math.floor(wobble);
      for (let x = cx - 2; x <= cx + 1; x++) {
        if (x >= 0 && x < 16) {
          const shade = x === cx - 2 ? trunk[5] : x === cx + 1 ? trunk[0] : trunk[3];
          setPixel(ctx, ox + x, y, shade);
        }
      }
      // Ring texture every 4 rows
      if (y % 4 === 0) {
        for (let x = cx - 2; x <= cx + 1; x++) {
          if (x >= 0 && x < 16) setPixel(ctx, ox + x, y, trunk[1]);
        }
      }
    }

    // Coconuts
    setPixel(ctx, ox + 7, 19, trunk[1]);
    setPixel(ctx, ox + 8, 19, trunk[3]);
    setPixel(ctx, ox + 9, 20, trunk[1]);

    // --- Crown (top 20 rows, y 0-19) — shifted ---
    const frondAngles = [
      { dx: -7, dy: 4, len: 12 },
      { dx: -5, dy: -2, len: 10 },
      { dx: -2, dy: -5, len: 8 },
      { dx: 2, dy: -5, len: 8 },
      { dx: 5, dy: -2, len: 10 },
      { dx: 7, dy: 4, len: 12 },
    ];

    const topY = 18;
    const topX = 8 + shift;

    frondAngles.forEach((frond) => {
      for (let i = 0; i < frond.len; i++) {
        const t = i / frond.len;
        const x = Math.round(topX + frond.dx * t);
        const y = Math.round(topY + frond.dy * t - (1 - t) * 3);
        if (x >= 0 && x < 16 && y >= 0 && y < 48) {
          setPixel(ctx, ox + x, y, i < 3 ? leaves[5] : leaves[3]);
          if (x > 0) setPixel(ctx, ox + x - 1, y, leaves[1]);
          if (x < 15) setPixel(ctx, ox + x + 1, y, leaves[0]);
        }
      }
    });
  }

  saveSheet(canvas, 'palm-frond-sheet.png');
}

// ---------------------------------------------------------------------------
// 3. Market awning flutter — 3 frames, 16x16 each => 48x16
// ---------------------------------------------------------------------------
function generateAwningFlutter() {
  const frameW = 16;
  const frameH = 16;
  const frames = 3;
  const canvas = createCanvas(frameW * frames, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const cloth = PALETTE.clothRed;
  const white = PALETTE.whitewash;

  // Bottom edge undulation offsets per frame: 0, -1 (up), +1 (down)
  const edgeOffsets = [0, -1, 1];

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW;
    const edgeOff = edgeOffsets[f];

    // Awning body — striped red/white
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < frameW; x++) {
        const stripe = Math.floor(x / 4) % 2;
        const shade = y < 2 ? (stripe ? cloth[5] : white[5]) : (stripe ? cloth[4] : white[4]);
        setPixel(ctx, ox + x, y, shade);
      }
    }

    // Shadow on the awning (darker bottom portion)
    for (let x = 0; x < frameW; x++) {
      const stripe = Math.floor(x / 4) % 2;
      setPixel(ctx, ox + x, 13, stripe ? cloth[2] : white[2]);
    }

    // Bottom cloth edge — undulates per frame
    for (let x = 0; x < frameW; x++) {
      const stripe = Math.floor(x / 4) % 2;
      // Wavy pattern: alternate columns shift by edgeOff
      const wavey = 14 + edgeOff * ((x % 4 < 2) ? 1 : 0);
      if (wavey >= 0 && wavey < frameH) {
        setPixel(ctx, ox + x, wavey, stripe ? cloth[3] : white[3]);
      }
      // Fringe one row below
      const fringeY = wavey + 1;
      if (fringeY >= 0 && fringeY < frameH) {
        setPixel(ctx, ox + x, fringeY, stripe ? cloth[1] : white[1]);
      }
    }
  }

  saveSheet(canvas, 'awning-flutter-sheet.png');
}

// ---------------------------------------------------------------------------
// 4. Smoke column — 4 frames, 8x16 each => 32x16
// ---------------------------------------------------------------------------
function generateSmokeColumn() {
  const frameW = 8;
  const frameH = 16;
  const frames = 4;
  const canvas = createCanvas(frameW * frames, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const smoke = PALETTE.whitewash;

  // Define wisps: each wisp has a base y, x-center, and width
  // Wisps drift up 2px per frame and fade (lighter colors)
  const baseWisps = [
    { x: 4, y: 14, w: 3 },
    { x: 3, y: 10, w: 2 },
    { x: 5, y: 6, w: 2 },
    { x: 4, y: 2, w: 3 },
  ];

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW;

    for (let wi = 0; wi < baseWisps.length; wi++) {
      const wisp = baseWisps[wi];
      // Each frame, wisps drift up by 2px * frame index, wrapping
      const driftY = wisp.y - (f * 2);

      // Fade based on how high (lower y = higher = more faded)
      // Determine color shade: higher = lighter/more transparent look
      for (let dy = 0; dy < 3; dy++) {
        const wy = driftY + dy;
        if (wy < 0 || wy >= frameH) continue;

        // Shade: top wisps are lighter (fade out), bottom wisps are more opaque
        const heightFactor = 1 - (wy / frameH); // 1 at top, 0 at bottom
        const shadeIdx = Math.min(4, Math.floor(2 + heightFactor * 2)); // indices 2-4

        const halfW = Math.floor(wisp.w / 2);
        // Slight lateral drift per wisp per frame
        const lateralDrift = Math.floor(seededRandom(wi, f, 42) * 2) - 1;
        const cx = wisp.x + lateralDrift;

        for (let dx = -halfW; dx <= halfW; dx++) {
          const px = cx + dx;
          if (px < 0 || px >= frameW) continue;
          setPixel(ctx, ox + px, wy, smoke[shadeIdx]);
        }
      }
    }
  }

  saveSheet(canvas, 'smoke-sheet.png');
}

// ---------------------------------------------------------------------------
// 5. Seagull flyby — 4 frames, 16x8 each => 64x8
// ---------------------------------------------------------------------------
function generateSeagullFlyby() {
  const frameW = 16;
  const frameH = 8;
  const frames = 4;
  const canvas = createCanvas(frameW * frames, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const body = PALETTE.whitewash;
  const wingTip = PALETTE.stone;

  // Wing positions: up / level / down / level
  // wingDY is the y-offset of the wing tips relative to body center
  const wingConfigs = [
    { tipDY: -2, label: 'up' },
    { tipDY: 0, label: 'level' },
    { tipDY: 2, label: 'down' },
    { tipDY: 0, label: 'level' },
  ];

  const bodyCX = 8; // center x of body within frame
  const bodyCY = 4; // center y of body within frame

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW;
    const wing = wingConfigs[f];

    // Body — small dot (2x2) at center
    setPixel(ctx, ox + bodyCX, bodyCY, body[6]);
    setPixel(ctx, ox + bodyCX + 1, bodyCY, body[5]);
    setPixel(ctx, ox + bodyCX, bodyCY + 1, body[4]);
    setPixel(ctx, ox + bodyCX + 1, bodyCY + 1, body[4]);

    // Head — 1px in front
    setPixel(ctx, ox + bodyCX + 2, bodyCY, body[7]);

    // Left wing — M shape
    // Wing extends from body center to the left
    for (let i = 1; i <= 5; i++) {
      const wx = bodyCX - i;
      // Interpolate y from body to tip
      const t = i / 5;
      const wy = Math.round(bodyCY + wing.tipDY * t);
      if (wx >= 0 && wy >= 0 && wy < frameH) {
        // Wing tip uses darker color
        const color = i >= 4 ? wingTip[4] : body[5];
        setPixel(ctx, ox + wx, wy, color);
      }
    }

    // Right wing — mirror
    for (let i = 1; i <= 5; i++) {
      const wx = bodyCX + 1 + i;
      const t = i / 5;
      const wy = Math.round(bodyCY + wing.tipDY * t);
      if (wx < frameW && wy >= 0 && wy < frameH) {
        const color = i >= 4 ? wingTip[4] : body[5];
        setPixel(ctx, ox + wx, wy, color);
      }
    }
  }

  saveSheet(canvas, 'seagull-sheet.png');
}

// ---------------------------------------------------------------------------
// 6. Flag wave — 3 frames, 16x16 each => 48x16
// ---------------------------------------------------------------------------
function generateFlagWave() {
  const frameW = 16;
  const frameH = 16;
  const frames = 3;
  const canvas = createCanvas(frameW * frames, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const wood = PALETTE.wood;
  const cloth = PALETTE.clothRed;

  // Wave intensities per frame: straight, curved right, more curved
  const waveMagnitudes = [0, 1, 2];

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW;
    const waveMag = waveMagnitudes[f];

    // --- Vertical pole on left (2px wide, x=0..1, full height) ---
    for (let y = 0; y < frameH; y++) {
      setPixel(ctx, ox + 0, y, wood[4]);
      setPixel(ctx, ox + 1, y, wood[3]);
    }

    // Pole finial (top)
    setPixel(ctx, ox + 0, 0, wood[6]);
    setPixel(ctx, ox + 1, 0, wood[5]);

    // --- Flag cloth (attached to pole, billows right) ---
    // Flag spans from x=2 to x=13, y=1 to y=10
    const flagTop = 1;
    const flagBottom = 10;
    const flagLeft = 2;
    const flagMaxRight = 13;

    for (let y = flagTop; y <= flagBottom; y++) {
      // Wave offset: sinusoidal curve, more pronounced with waveMag
      const rowT = (y - flagTop) / (flagBottom - flagTop); // 0-1
      const waveOffset = Math.floor(Math.sin(rowT * Math.PI) * waveMag);

      const flagWidth = flagMaxRight - flagLeft;
      for (let dx = 0; dx < flagWidth; dx++) {
        const px = flagLeft + dx + waveOffset;
        if (px < 0 || px >= frameW) continue;

        // Color: main flag body is clothRed, with shading
        let shade;
        if (dx < 2) {
          shade = cloth[5]; // near pole, lit
        } else if (dx > flagWidth - 3) {
          shade = cloth[3]; // trailing edge, darker
        } else {
          shade = cloth[4]; // mid
        }

        // Add slight wave shadow where the curve peaks
        if (waveOffset > 0 && dx > flagWidth / 2) {
          shade = cloth[3];
        }

        setPixel(ctx, ox + px, y, shade);
      }
    }

    // Flag top and bottom edges (slightly darker border)
    for (let dx = 0; dx < flagMaxRight - flagLeft; dx++) {
      const waveOffTop = Math.floor(Math.sin(0) * waveMag);
      const waveOffBot = Math.floor(Math.sin(Math.PI) * waveMag);
      const pxTop = flagLeft + dx + waveOffTop;
      const pxBot = flagLeft + dx + waveOffBot;
      if (pxTop >= 0 && pxTop < frameW) {
        setPixel(ctx, ox + pxTop, flagTop, cloth[2]);
      }
      if (pxBot >= 0 && pxBot < frameW) {
        setPixel(ctx, ox + pxBot, flagBottom, cloth[2]);
      }
    }
  }

  saveSheet(canvas, 'flag-sheet.png');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('Generating Animated Object Sprite Sheets\n');

  generateTorchFlame();
  generatePalmFrondSway();
  generateAwningFlutter();
  generateSmokeColumn();
  generateSeagullFlyby();
  generateFlagWave();

  console.log('\nAll animated sprite sheets generated!');
}

main();
