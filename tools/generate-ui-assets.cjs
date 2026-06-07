#!/usr/bin/env node
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { PALETTE, hexToRgb, rgbToHex, lerpColor, DITHER_MATRIX } = require('./ultima8-graphics/palette.cjs');

// ---------------------------------------------------------------------------
// Output directories
// ---------------------------------------------------------------------------
const UI_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'ui');
const ITEMS_DIR = path.join(UI_DIR, 'items');

fs.mkdirSync(UI_DIR, { recursive: true });
fs.mkdirSync(ITEMS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) – deterministic output across runs
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(15801580); // seed: Melaka 1580

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setPixel(ctx, x, y, hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return;
  if (alpha !== undefined && alpha < 1) {
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
  } else {
    ctx.fillStyle = hex;
  }
  ctx.fillRect(x, y, 1, 1);
}

function fillRect(ctx, x, y, w, h, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function saveCanvas(canvas, filePath) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`  -> ${path.relative(path.join(__dirname, '..'), filePath)}`);
}

// ---------------------------------------------------------------------------
// CARVED-CHROME PRIMITIVES (Skald / Ultima VIII / Dungeon-Keeper direction)
//
// All chrome is palette-LOCKED (only colours straight out of palette.cjs),
// hard-edged (no alpha blending on edges => no anti-aliasing) and lit from
// the North-West.  A "carved" bevel reads as:
//   - outer/top-left rim  = brightest ramp shade  (catches the NW light)
//   - mid frame body      = mid ramp shade
//   - inner/bottom-right  = darkest ramp shade     (falls into shadow)
// Convex edges get a 1px highlight inset; concave edges a 1px shadow inset.
// ---------------------------------------------------------------------------

// Solid (opaque) palette pixel — never partial alpha, so edges stay hard.
function px(ctx, x, y, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, 1, 1);
}

// Horizontal / vertical 1px palette lines (hard edges).
function hLine(ctx, x, y, len, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, len, 1);
}
function vLine(ctx, x, y, len, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, 1, len);
}

/**
 * Draw a rectangular carved-chrome border ring of thickness `t` around the
 * rect (x,y,w,h).  Uses a metal ramp (default gold).  NW light source:
 * top + left rim are bright, bottom + right rim drop into shadow, with a
 * mid-value body in between.  Returns nothing; leaves the interior untouched
 * (transparent / caller-filled).
 *
 * ramp index plan (8-shade ramp):
 *   outer light rim   -> bright   (NW) / mid-dark (SE)
 *   body              -> light    (NW) / mid      (SE)
 *   inner dark rim    -> mid-dark (NW) / darkest  (SE)
 */
function carvedRing(ctx, x, y, w, h, t, ramp) {
  const x1 = x + w - 1;
  const y1 = y + h - 1;
  for (let i = 0; i < t; i++) {
    // Per-layer shade selection from outer (i=0) to inner (i=t-1).
    let lightShade, darkShade;
    if (i === 0) {
      lightShade = ramp[7]; // brightest catches NW light
      darkShade = ramp[2];
    } else if (i === t - 1) {
      lightShade = ramp[4]; // inner NW edge
      darkShade = ramp[0];  // inner SE edge = deepest carve shadow
    } else {
      lightShade = ramp[6]; // body NW
      darkShade = ramp[3];  // body SE
    }
    // Top edge (NW light) and left edge (NW light)
    hLine(ctx, x + i, y + i, w - i * 2, lightShade);
    vLine(ctx, x + i, y + i, h - i * 2, lightShade);
    // Bottom edge (SE shadow) and right edge (SE shadow)
    hLine(ctx, x + i, y1 - i, w - i * 2, darkShade);
    vLine(ctx, x1 - i, y + i, h - i * 2, darkShade);
  }
}

/**
 * Carved gold corner ornament: a small filled diamond/boss.
 * `bright` = true -> top-left style (bright gold core, dark SE pixel),
 *            false -> bottom-right style (dark gold core, bright NW pixel).
 */
function cornerOrnament(ctx, cx, cy, bright) {
  const gold = PALETTE.gold;
  const core = bright ? gold[7] : gold[3];
  const rim = bright ? gold[4] : gold[1];
  const glint = bright ? gold[7] : gold[5];
  // Diamond: center + 4 cardinal pixels
  px(ctx, cx, cy, core);
  px(ctx, cx - 1, cy, rim);
  px(ctx, cx + 1, cy, rim);
  px(ctx, cx, cy - 1, rim);
  px(ctx, cx, cy + 1, rim);
  // NW glint pixel for the carved highlight
  px(ctx, cx - 1, cy - 1, glint);
  // SE shadow pixel
  px(ctx, cx + 1, cy + 1, bright ? gold[1] : gold[0]);
}

/**
 * Fill a rect with a vertical 2-step dithered parchment-ish panel using the
 * provided ramp, NW lit (top lighter). Hard-edged Bayer dither => no AA.
 */
function fillBeveledPanel(ctx, x, y, w, h, ramp, topIdx, botIdx) {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    // Choose two adjacent ramp indices to dither between for this row.
    const f = topIdx + (botIdx - topIdx) * t;
    const lo = Math.floor(f);
    const hi = clamp(lo + 1, 0, ramp.length - 1);
    const frac = f - lo;
    for (let xx = 0; xx < w; xx++) {
      const threshold = (DITHER_MATRIX[yy % 4][xx % 4]) / 16;
      const idx = frac > threshold ? hi : lo;
      px(ctx, x + xx, y + yy, ramp[clamp(idx, 0, ramp.length - 1)]);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Parchment Background (512×128)
// ---------------------------------------------------------------------------
function generateParchment() {
  console.log('Generating parchment-bg.png ...');
  const W = 512, H = 128;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base parchment colors derived from palette warm tones
  const baseR = 212, baseG = 197, baseB = 160; // #D4C5A0

  // Pass 1 – base fill with per-pixel noise
  const imgData = ctx.createImageData(W, H);
  const d = imgData.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      // Noise offset
      const noise = (rng() - 0.5) * 30;
      // Low-frequency undulation
      const wave = Math.sin(x * 0.012 + y * 0.02) * 8 +
                   Math.sin(x * 0.007 - y * 0.015) * 6;

      d[idx]     = clamp(baseR + noise + wave, 0, 255);
      d[idx + 1] = clamp(baseG + noise + wave - 4, 0, 255);
      d[idx + 2] = clamp(baseB + noise + wave - 12, 0, 255);
      d[idx + 3] = 255;
    }
  }

  // Pass 2 – edge vignette
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const edgeX = Math.min(x, W - 1 - x) / (W * 0.15);
      const edgeY = Math.min(y, H - 1 - y) / (H * 0.2);
      const edgeFactor = clamp(Math.min(edgeX, edgeY), 0, 1);
      const darken = 1.0 - (1.0 - edgeFactor) * 0.35;
      d[idx]     = clamp(d[idx] * darken, 0, 255);
      d[idx + 1] = clamp(d[idx + 1] * darken, 0, 255);
      d[idx + 2] = clamp(d[idx + 2] * darken, 0, 255);
    }
  }

  // Pass 3 – stain marks (darker spots)
  const stainCount = 6;
  for (let s = 0; s < stainCount; s++) {
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    const radius = 8 + Math.floor(rng() * 20);
    const intensity = 0.08 + rng() * 0.12;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        if (dist > 1) continue;
        const falloff = (1 - dist * dist) * intensity;
        const idx = (py * W + px) * 4;
        d[idx]     = clamp(d[idx] * (1 - falloff), 0, 255);
        d[idx + 1] = clamp(d[idx + 1] * (1 - falloff * 1.1), 0, 255);
        d[idx + 2] = clamp(d[idx + 2] * (1 - falloff * 0.9), 0, 255);
      }
    }
  }

  // Pass 4 – crease / fold lines
  const creases = [
    { x: Math.floor(W * 0.33), vertical: true },
    { x: Math.floor(W * 0.66), vertical: true },
    { y: Math.floor(H * 0.5), vertical: false },
  ];
  for (const crease of creases) {
    if (crease.vertical) {
      for (let y = 0; y < H; y++) {
        const offset = Math.floor(Math.sin(y * 0.08) * 1.5);
        for (let dx = -1; dx <= 1; dx++) {
          const px = crease.x + dx + offset;
          if (px < 0 || px >= W) continue;
          const idx = (y * W + px) * 4;
          const factor = dx === 0 ? 0.88 : 0.94;
          d[idx]     = clamp(d[idx] * factor, 0, 255);
          d[idx + 1] = clamp(d[idx + 1] * factor, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] * factor, 0, 255);
        }
      }
    } else {
      for (let x = 0; x < W; x++) {
        const offset = Math.floor(Math.sin(x * 0.06) * 1);
        for (let dy = -1; dy <= 1; dy++) {
          const py = crease.y + dy + offset;
          if (py < 0 || py >= H) continue;
          const idx = (py * W + x) * 4;
          const factor = dy === 0 ? 0.88 : 0.94;
          d[idx]     = clamp(d[idx] * factor, 0, 255);
          d[idx + 1] = clamp(d[idx + 1] * factor, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] * factor, 0, 255);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, path.join(UI_DIR, 'parchment-bg.png'));
}

// ---------------------------------------------------------------------------
// 2. Border Corner – Azulejo (16×16)
// ---------------------------------------------------------------------------
function generateBorderCorner() {
  console.log('Generating border-corner.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const blue = PALETTE.clothBlue;
  const white = PALETTE.whitewash;

  // Fill white base
  fillRect(ctx, 0, 0, S, S, white[7]);

  // Portuguese azulejo geometric floral pattern
  // Outer border (blue)
  for (let i = 0; i < S; i++) {
    setPixel(ctx, i, 0, blue[5]);    // top
    setPixel(ctx, i, S - 1, blue[5]);// bottom
    setPixel(ctx, 0, i, blue[5]);    // left
    setPixel(ctx, S - 1, i, blue[5]);// right
  }
  // Second border line
  for (let i = 1; i < S - 1; i++) {
    setPixel(ctx, i, 1, blue[3]);
    setPixel(ctx, i, S - 2, blue[3]);
    setPixel(ctx, 1, i, blue[3]);
    setPixel(ctx, S - 2, i, blue[3]);
  }

  // Diamond in center
  const center = 7;
  const diamondPixels = [
    [center, 3], [center, 4],
    [center - 1, 4], [center + 1, 4],
    [center - 2, 5], [center + 2, 5],
    [center - 3, 6], [center + 3, 6],
    [center - 3, 7], [center + 3, 7],
    [center - 4, 7], [center + 4, 7],
    [center - 3, 8], [center + 3, 8],
    [center - 3, 9], [center + 3, 9],
    [center - 2, 10], [center + 2, 10],
    [center - 1, 11], [center + 1, 11],
    [center, 11], [center, 12],
  ];
  for (const [px, py] of diamondPixels) {
    if (px >= 2 && px < S - 2 && py >= 2 && py < S - 2) {
      setPixel(ctx, px, py, blue[6]);
    }
  }

  // Floral dots in the four quadrants
  const dots = [
    [4, 4], [11, 4], [4, 11], [11, 11], // corner accents
    [7, 7], [8, 7], [7, 8], [8, 8],     // center fill
  ];
  for (const [px, py] of dots) {
    setPixel(ctx, px, py, blue[7]);
  }

  // Small accent crosses
  const crosses = [[4, 7], [11, 7], [7, 4], [7, 11]];
  for (const [cx, cy] of crosses) {
    if (cx >= 2 && cx < S - 2 && cy >= 2 && cy < S - 2) {
      setPixel(ctx, cx, cy, blue[4]);
    }
  }

  // White highlight dots on blue border intersections for depth
  setPixel(ctx, 0, 0, blue[7]);
  setPixel(ctx, S - 1, 0, blue[7]);
  setPixel(ctx, 0, S - 1, blue[7]);
  setPixel(ctx, S - 1, S - 1, blue[7]);

  saveCanvas(canvas, path.join(UI_DIR, 'border-corner.png'));
}

// ---------------------------------------------------------------------------
// 3. Portrait Frame (104×104) — carved gold chrome, transparent center
// ---------------------------------------------------------------------------
function generatePortraitFrame() {
  console.log('Generating portrait-frame.png ...');
  const S = 104;          // MUST stay 104×104 (CSS .ui-portrait-frame)
  const T = 8;            // ring thickness
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const gold = PALETTE.gold;
  const wood = PALETTE.wood;
  const shadow = PALETTE.shadow;

  ctx.clearRect(0, 0, S, S); // transparent center stays transparent

  // Outer dark mounting bezel (1px) so the frame reads as carved metal on wood.
  carvedRing(ctx, 0, 0, S, S, 1, wood);

  // Main carved gold ring.
  carvedRing(ctx, 1, 1, S - 2, S - 2, T, gold);

  // Inner shadow lip (concave) — 1px dark line where portrait sits below frame.
  const inner = 1 + T;
  carvedRing(ctx, inner, inner, S - inner * 2, S - inner * 2, 1, shadow);

  // 1px bright highlight line inset on the convex outer-top/left edges.
  hLine(ctx, 2, 1, S - 4, gold[7]);
  vLine(ctx, 1, 2, S - 4, gold[7]);

  // Corner ornaments: bright gold NW, dark gold SE.
  cornerOrnament(ctx, 5, 5, true);            // top-left  (brightest)
  cornerOrnament(ctx, S - 6, 5, true);        // top-right
  cornerOrnament(ctx, 5, S - 6, false);       // bottom-left
  cornerOrnament(ctx, S - 6, S - 6, false);   // bottom-right (darkest)

  // Mid-edge rivet ticks for ornament rhythm (NW lit on top/left).
  const mid = Math.floor(S / 2);
  px(ctx, mid, 1, gold[7]); px(ctx, mid, 2, gold[5]);            // top
  px(ctx, 1, mid, gold[7]); px(ctx, 2, mid, gold[5]);            // left
  px(ctx, mid, S - 2, gold[1]); px(ctx, mid, S - 3, gold[3]);    // bottom (shadow)
  px(ctx, S - 2, mid, gold[1]); px(ctx, S - 3, mid, gold[3]);    // right (shadow)

  saveCanvas(canvas, path.join(UI_DIR, 'portrait-frame.png'));
}

// ---------------------------------------------------------------------------
// 3b. Dialogue Box (640×160) — carved wood+gold panel, parchment interior
// ---------------------------------------------------------------------------
function generateDialogueBox() {
  console.log('Generating dialogue-box.png ...');
  const W = 640, H = 160;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const wood = PALETTE.wood;
  const gold = PALETTE.gold;
  const sand = PALETTE.sand;
  const shadow = PALETTE.shadow;

  // Parchment interior fill (NW lit, dithered).
  fillBeveledPanel(ctx, 0, 0, W, H, sand, 6, 4);

  // Outer carved wood frame (4px).
  carvedRing(ctx, 0, 0, W, H, 4, wood);
  // Gold inlay ring just inside the wood (2px).
  carvedRing(ctx, 4, 4, W - 8, H - 8, 2, gold);
  // Inner shadow lip where text sits.
  carvedRing(ctx, 6, 6, W - 12, H - 12, 1, shadow);

  // 1px bright highlight line inset along convex top + left of the gold inlay.
  hLine(ctx, 6, 4, W - 12, gold[7]);
  vLine(ctx, 4, 6, H - 12, gold[7]);

  // Corner ornaments inside the gold ring.
  cornerOrnament(ctx, 8, 8, true);
  cornerOrnament(ctx, W - 9, 8, true);
  cornerOrnament(ctx, 8, H - 9, false);
  cornerOrnament(ctx, W - 9, H - 9, false);

  saveCanvas(canvas, path.join(UI_DIR, 'dialogue-box.png'));
}

// ---------------------------------------------------------------------------
// 3c. Parchment Panel (320×200) — carved gold edge, parchment field
// ---------------------------------------------------------------------------
function generatePanelParchment() {
  console.log('Generating panel-parchment.png ...');
  const W = 320, H = 200;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const sand = PALETTE.sand;
  const gold = PALETTE.gold;
  const wood = PALETTE.wood;
  const shadow = PALETTE.shadow;

  // Parchment field.
  fillBeveledPanel(ctx, 0, 0, W, H, sand, 6, 3);

  // Thin wood backing rim, then carved gold ring.
  carvedRing(ctx, 0, 0, W, H, 2, wood);
  carvedRing(ctx, 2, 2, W - 4, H - 4, 3, gold);
  carvedRing(ctx, 5, 5, W - 10, H - 10, 1, shadow);

  // Convex highlight inset (top/left).
  hLine(ctx, 4, 2, W - 8, gold[7]);
  vLine(ctx, 2, 4, H - 8, gold[7]);

  // Corner ornaments.
  cornerOrnament(ctx, 6, 6, true);
  cornerOrnament(ctx, W - 7, 6, true);
  cornerOrnament(ctx, 6, H - 7, false);
  cornerOrnament(ctx, W - 7, H - 7, false);

  saveCanvas(canvas, path.join(UI_DIR, 'panel-parchment.png'));
}

// ---------------------------------------------------------------------------
// 3d. Inventory Slot (48×48) — sunken carved socket, transparent center
// ---------------------------------------------------------------------------
function generateInventorySlot() {
  console.log('Generating inventory-slot.png ...');
  const S = 48, T = 3;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const wood = PALETTE.wood;
  const gold = PALETTE.gold;
  const shadow = PALETTE.shadow;

  ctx.clearRect(0, 0, S, S); // transparent center for the item icon

  // A socket reads SUNKEN: invert the NW/SE light by drawing a dark outer
  // rim that lightens toward the inner edge.  We achieve this by stacking
  // an inverted carved ring (dark top-left, light bottom-right) using wood.
  for (let i = 0; i < T; i++) {
    const x1 = S - 1 - i;
    const y1 = S - 1 - i;
    const lightShade = i === 0 ? shadow[2] : wood[2]; // top/left = shadow (sunken)
    const darkShade  = i === 0 ? wood[6] : wood[5];   // bottom/right = lit
    hLine(ctx, i, i, S - i * 2, lightShade);   // top
    vLine(ctx, i, i, S - i * 2, lightShade);   // left
    hLine(ctx, i, y1, S - i * 2, darkShade);   // bottom
    vLine(ctx, x1, i, S - i * 2, darkShade);   // right
  }

  // Thin gold inner lip framing the socket opening (carved).
  carvedRing(ctx, T, T, S - T * 2, S - T * 2, 1, gold);

  // Gold corner studs (bright NW, dark SE).
  cornerOrnament(ctx, 4, 4, true);
  cornerOrnament(ctx, S - 5, 4, true);
  cornerOrnament(ctx, 4, S - 5, false);
  cornerOrnament(ctx, S - 5, S - 5, false);

  saveCanvas(canvas, path.join(UI_DIR, 'inventory-slot.png'));
}

// ---------------------------------------------------------------------------
// 3e. Buttons (120×28) — carved gold-rimmed wood, 3 states
// ---------------------------------------------------------------------------
function generateButton(state) {
  const name = `button-${state}.png`;
  console.log(`Generating ${name} ...`);
  const W = 120, H = 28;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const wood = PALETTE.wood;
  const gold = PALETTE.gold;
  const shadow = PALETTE.shadow;

  // Face fill — hover is a touch brighter, active is pressed/darker.
  const topIdx = state === 'hover' ? 6 : state === 'active' ? 3 : 5;
  const botIdx = state === 'hover' ? 4 : state === 'active' ? 1 : 3;
  fillBeveledPanel(ctx, 0, 0, W, H, wood, topIdx, botIdx);

  if (state === 'active') {
    // Pressed: invert the bevel (dark top/left, light bottom/right) = sunken.
    hLine(ctx, 0, 0, W, shadow[2]);
    vLine(ctx, 0, 0, H, shadow[2]);
    hLine(ctx, 0, H - 1, W, gold[3]);
    vLine(ctx, W - 1, 0, H, gold[3]);
    carvedRing(ctx, 1, 1, W - 2, H - 2, 1, gold);
  } else {
    // Raised carved gold rim, NW lit.
    carvedRing(ctx, 0, 0, W, H, 2, gold);
    // 1px convex highlight inset on top/left.
    hLine(ctx, 2, 1, W - 4, gold[7]);
    vLine(ctx, 1, 2, H - 4, gold[7]);
    if (state === 'hover') {
      // Hover glow: brighten the top rim further.
      hLine(ctx, 1, 0, W - 2, gold[7]);
    }
  }

  // Corner ornaments.
  const briNW = state !== 'active';
  cornerOrnament(ctx, 3, 3, briNW);
  cornerOrnament(ctx, W - 4, 3, briNW);
  cornerOrnament(ctx, 3, H - 4, false);
  cornerOrnament(ctx, W - 4, H - 4, false);

  saveCanvas(canvas, path.join(UI_DIR, name));
}

// ---------------------------------------------------------------------------
// 3f. Orbs (24×24) — stepped-bevel sphere, drop shadow.  ramp drives colour.
// ---------------------------------------------------------------------------
function generateOrb(name, ramp, accentRamp) {
  console.log(`Generating ${name} ...`);
  const S = 24;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const shadow = PALETTE.shadow;
  const spec = PALETTE.specular;

  const cx = 11.5, cy = 11.0, r = 10;
  // Drop shadow (offset SE), hard-edged dark disc.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - (cx + 2), dy = y - (cy + 3);
      if (dx * dx + dy * dy <= (r - 1) * (r - 1)) px(ctx, x, y, shadow[1]);
    }
  }

  // Sphere: stepped bevel via distance + NW light bands (no AA, palette steps).
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      // Lighting term: NW light (-x,-y), stepped into ramp bands.
      const nl = (-dx - dy) / (r * 1.4);       // -1..1, bright at NW
      const edge = 1 - dist / r;               // 0 at rim, 1 at center
      let lvl = (nl * 0.6 + edge * 0.4);       // combine
      // Quantize to discrete ramp steps (stepped-bevel look).
      let idx;
      if (lvl > 0.62) idx = 7;
      else if (lvl > 0.42) idx = 6;
      else if (lvl > 0.24) idx = 5;
      else if (lvl > 0.08) idx = 4;
      else if (lvl > -0.06) idx = 3;
      else if (lvl > -0.22) idx = 2;
      else idx = 1;
      // Rim shadow ring for the carved sphere edge.
      if (dist > r - 1.0) idx = Math.min(idx, 1);
      px(ctx, x, y, ramp[idx]);
    }
  }

  // Specular glint hotspot (NW), accent ramp tint for energy orb.
  px(ctx, 7, 6, spec[7]);
  px(ctx, 8, 6, spec[5]);
  px(ctx, 7, 7, accentRamp ? accentRamp[7] : spec[6]);
  px(ctx, 6, 7, spec[3]);

  saveCanvas(canvas, path.join(UI_DIR, name));
}

// ---------------------------------------------------------------------------
// 3g. Coin Icon (16×16) — carved gold disc, NW lit
// ---------------------------------------------------------------------------
function generateCoinIcon() {
  console.log('Generating coin-icon.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const gold = PALETTE.gold;
  const shadow = PALETTE.shadow;
  const cx = 7.5, cy = 7.5, r = 7;

  // Drop shadow.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - (cx + 1), dy = y - (cy + 1.5);
    if (dx * dx + dy * dy <= (r - 1) * (r - 1)) px(ctx, x, y, shadow[2]);
  }
  // Disc body with NW-lit stepped bevel.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r) continue;
    const nl = (-dx - dy) / (r * 1.4);
    let idx = nl > 0.4 ? 7 : nl > 0.1 ? 6 : nl > -0.2 ? 5 : 4;
    if (dist > r - 1) idx = 2;          // dark rim
    px(ctx, x, y, gold[idx]);
  }
  // Embossed center mark (a carved cross / coin face).
  px(ctx, 7, 5, gold[2]); px(ctx, 7, 6, gold[2]);
  px(ctx, 7, 9, gold[2]); px(ctx, 7, 10, gold[2]);
  px(ctx, 5, 7, gold[2]); px(ctx, 6, 7, gold[2]);
  px(ctx, 9, 8, gold[2]); px(ctx, 10, 8, gold[2]);
  px(ctx, 7, 7, gold[7]); px(ctx, 8, 7, gold[6]); // NW glint on relief
  px(ctx, 7, 8, gold[5]); px(ctx, 8, 8, gold[3]);

  saveCanvas(canvas, path.join(UI_DIR, 'coin-icon.png'));
}

// ---------------------------------------------------------------------------
// 3h. Journal Icon (16×16) — carved gilt book
// ---------------------------------------------------------------------------
function generateJournalIcon() {
  console.log('Generating journal-icon.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const wood = PALETTE.wood;     // leather cover
  const gold = PALETTE.gold;     // gilt edge / clasp
  const sand = PALETTE.sand;     // pages
  const shadow = PALETTE.shadow;

  // Drop shadow.
  ctx.fillStyle = shadow[2];
  ctx.fillRect(4, 14, 9, 1);

  // Cover (leather) with carved bevel.
  for (let y = 2; y <= 13; y++) {
    for (let x = 3; x <= 12; x++) {
      let idx = 4;
      if (y === 2 || x === 3) idx = 6;        // NW lit edges
      if (y === 13 || x === 12) idx = 2;      // SE shadow edges
      px(ctx, x, y, wood[idx]);
    }
  }
  // Page block on the right (fore-edge), NW lit.
  for (let y = 3; y <= 12; y++) {
    px(ctx, 12, y, sand[6]);
    px(ctx, 11, y, sand[5]);
  }
  // Spine on left (gilt).
  vLine(ctx, 4, 3, 10, gold[6]);
  px(ctx, 4, 3, gold[7]);   // NW glint
  px(ctx, 4, 12, gold[2]);  // SE shadow
  // Gilt clasp across center-right.
  px(ctx, 12, 7, gold[7]); px(ctx, 13, 7, gold[5]);
  px(ctx, 12, 8, gold[3]); px(ctx, 13, 8, gold[1]);
  // Carved title line on the cover.
  hLine(ctx, 6, 6, 5, gold[5]);
  px(ctx, 6, 6, gold[7]);

  saveCanvas(canvas, path.join(UI_DIR, 'journal-icon.png'));
}

// ---------------------------------------------------------------------------
// 3i. Scroll Top (16×16) — carved scroll roller header
// ---------------------------------------------------------------------------
function generateScrollTop() {
  console.log('Generating scroll-top.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const wood = PALETTE.wood;
  const gold = PALETTE.gold;
  const sand = PALETTE.sand;

  // Parchment hanging below the roller.
  for (let y = 7; y <= 15; y++) {
    for (let x = 3; x <= 12; x++) {
      let idx = 5;
      if (x === 3) idx = 6;       // NW lit
      if (x === 12) idx = 3;      // SE shadow
      px(ctx, x, y, sand[idx]);
    }
  }
  // The roller (horizontal carved wood dowel) across the top.
  for (let x = 1; x <= 14; x++) {
    px(ctx, x, 4, wood[6]);   // NW-lit top
    px(ctx, x, 5, wood[5]);
    px(ctx, x, 6, wood[2]);   // SE shadow underside
  }
  // Gold end-caps (carved knobs).
  cornerOrnament(ctx, 2, 5, true);
  cornerOrnament(ctx, 13, 5, false);
  // Highlight line along the roller top (convex).
  hLine(ctx, 2, 3, 13, wood[7]);

  saveCanvas(canvas, path.join(UI_DIR, 'scroll-top.png'));
}

// ---------------------------------------------------------------------------
// 4. Inventory Item Icons (16×16 each)
// ---------------------------------------------------------------------------

// Helper to draw a filled circle
function drawCircle(ctx, cx, cy, r, color) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        setPixel(ctx, cx + dx, cy + dy, color);
      }
    }
  }
}

// Helper to draw a single-pixel line (Bresenham)
function drawLine(ctx, x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    setPixel(ctx, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function generateTradingSeal() {
  console.log('Generating trading-seal.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const red = PALETTE.clothRed;

  // Wax seal body – dark red circle
  drawCircle(ctx, 7, 8, 5, red[4]);
  drawCircle(ctx, 7, 8, 4, red[5]);
  drawCircle(ctx, 7, 8, 3, red[6]);

  // Highlight on top-left
  setPixel(ctx, 5, 6, red[7]);
  setPixel(ctx, 6, 6, red[7]);
  setPixel(ctx, 5, 7, red[7]);

  // Shadow on bottom-right
  setPixel(ctx, 9, 10, red[3]);
  setPixel(ctx, 10, 9, red[3]);
  setPixel(ctx, 10, 10, red[2]);

  // Impression mark (cross/seal pattern in center)
  setPixel(ctx, 7, 7, red[3]);
  setPixel(ctx, 7, 8, red[3]);
  setPixel(ctx, 7, 9, red[3]);
  setPixel(ctx, 6, 8, red[3]);
  setPixel(ctx, 8, 8, red[3]);

  // Outer rim detail
  setPixel(ctx, 7, 3, red[3]);
  setPixel(ctx, 7, 13, red[3]);
  setPixel(ctx, 2, 8, red[3]);
  setPixel(ctx, 12, 8, red[3]);

  // Small bit of ribbon at top
  setPixel(ctx, 6, 2, red[4]);
  setPixel(ctx, 7, 2, red[5]);
  setPixel(ctx, 8, 2, red[4]);
  setPixel(ctx, 5, 1, red[3]);
  setPixel(ctx, 9, 1, red[3]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'trading-seal.png'));
}

function generateCoinPouch() {
  console.log('Generating coin-pouch.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const wood = PALETTE.wood; // brown leather
  const gold = PALETTE.gold;

  // Pouch body (rounded bag shape)
  // Bottom half – wide
  for (let y = 7; y <= 14; y++) {
    const halfWidth = Math.floor(4 + (1 - Math.abs(y - 10) / 5) * 2);
    for (let x = 7 - halfWidth; x <= 7 + halfWidth; x++) {
      if (x < 0 || x >= S) continue;
      const shade = x < 7 ? wood[5] : wood[4];
      setPixel(ctx, x, y, shade);
    }
  }
  // Top cinch
  for (let x = 5; x <= 9; x++) {
    setPixel(ctx, x, 6, wood[6]);
    setPixel(ctx, x, 5, wood[5]);
  }
  // Tie string
  setPixel(ctx, 7, 4, wood[3]);
  setPixel(ctx, 7, 3, wood[3]);
  setPixel(ctx, 6, 3, wood[2]);
  setPixel(ctx, 8, 3, wood[2]);

  // Leather highlight
  setPixel(ctx, 5, 8, wood[6]);
  setPixel(ctx, 5, 9, wood[6]);
  setPixel(ctx, 5, 10, wood[6]);

  // Shadow on right
  setPixel(ctx, 10, 10, wood[2]);
  setPixel(ctx, 10, 11, wood[2]);
  setPixel(ctx, 9, 12, wood[2]);

  // Gold coins peeking out of top
  setPixel(ctx, 6, 5, gold[6]);
  setPixel(ctx, 7, 4, gold[7]);
  setPixel(ctx, 8, 5, gold[5]);
  setPixel(ctx, 9, 4, gold[6]);
  setPixel(ctx, 9, 5, gold[4]);

  // Coin edge detail
  setPixel(ctx, 7, 3, gold[4]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'coin-pouch.png'));
}

function generateSpiceSample() {
  console.log('Generating spice-sample.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const terra = PALETTE.terracotta;
  const fire = PALETTE.fire;
  const sand = PALETTE.sand;

  // Small bowl/pile of spice
  // Pile shape – mound from bottom center
  const pilePixels = [
    // Bottom layer (widest)
    [4, 13], [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13],
    [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
    // Middle layer
    [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
    [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
    // Upper layer
    [6, 9], [7, 9], [8, 9], [9, 9],
    // Peak
    [7, 8], [8, 8],
  ];

  for (const [px, py] of pilePixels) {
    // Gradient: lighter on top, darker at base
    const heightFactor = (13 - py) / 5;
    let color;
    if (heightFactor > 0.7) color = fire[6]; // bright orange top
    else if (heightFactor > 0.4) color = fire[5];
    else if (heightFactor > 0.2) color = terra[5];
    else color = terra[4];

    // Left side slightly lighter (light source)
    if (px < 7) color = lerpColor(color, fire[7], 0.15);
    // Right side darker
    if (px > 9) color = lerpColor(color, terra[2], 0.2);

    setPixel(ctx, px, py, color);
  }

  // Scattered grains around base
  setPixel(ctx, 3, 14, terra[4]);
  setPixel(ctx, 12, 14, terra[3]);
  setPixel(ctx, 5, 14, fire[5]);
  setPixel(ctx, 10, 14, terra[5]);
  setPixel(ctx, 7, 14, fire[4]);

  // Shadow under pile
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 14, sand[2], 0.5);
  }

  saveCanvas(canvas, path.join(ITEMS_DIR, 'spice-sample.png'));
}

function generateLetter() {
  console.log('Generating letter.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const parchment = PALETTE.sand;
  const red = PALETTE.clothRed;
  const wood = PALETTE.wood;

  // Folded parchment body
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 12; x++) {
      let shade = parchment[6];
      // Fold shadow in middle
      if (y === 8) shade = parchment[4];
      if (y === 7) shade = parchment[5];
      // Edges slightly darker
      if (x === 3 || x === 12) shade = parchment[5];
      if (y === 3 || y === 13) shade = parchment[5];
      setPixel(ctx, x, y, shade);
    }
  }

  // Fold crease highlight above fold
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 6, parchment[7]);
  }

  // Corner fold (top-right)
  setPixel(ctx, 12, 3, '#00000000'); // transparent – folded away
  setPixel(ctx, 11, 3, parchment[4]);
  setPixel(ctx, 12, 4, parchment[4]);
  setPixel(ctx, 11, 4, parchment[3]);

  // Text lines (implied)
  for (let x = 5; x <= 10; x++) {
    if (x % 2 === 0) {
      setPixel(ctx, x, 5, wood[3]);
      setPixel(ctx, x, 10, wood[3]);
      setPixel(ctx, x, 12, wood[3]);
    }
  }

  // Wax seal on front (center-bottom)
  drawCircle(ctx, 7, 11, 1, red[5]);
  setPixel(ctx, 7, 11, red[6]);
  setPixel(ctx, 7, 10, red[4]);
  setPixel(ctx, 8, 11, red[4]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'letter.png'));
}

function generateRosary() {
  console.log('Generating rosary.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const gold = PALETTE.gold;
  const wood = PALETTE.wood;

  // Rosary beads arranged in a curved/oval loop
  // Bead positions forming a rough oval
  const beadPositions = [
    // Top arc
    [6, 2], [8, 2], [10, 3],
    // Right side
    [11, 5], [11, 7], [11, 9],
    // Bottom arc
    [10, 11], [8, 12], [6, 12],
    // Left side
    [4, 11], [3, 9], [3, 7], [3, 5],
    // Close top
    [4, 3],
  ];

  // Draw string between beads (darker gold)
  for (let i = 0; i < beadPositions.length; i++) {
    const [x1, y1] = beadPositions[i];
    const [x2, y2] = beadPositions[(i + 1) % beadPositions.length];
    drawLine(ctx, x1, y1, x2, y2, gold[2]);
  }

  // Draw beads
  for (const [bx, by] of beadPositions) {
    setPixel(ctx, bx, by, gold[5]);
    // Highlight
    if (bx > 6) setPixel(ctx, bx, by, gold[6]);
  }

  // Cross hanging from bottom center
  const crossX = 7, crossY = 13;
  // Vertical bar
  setPixel(ctx, crossX, 13, gold[6]);
  setPixel(ctx, crossX, 14, gold[5]);
  setPixel(ctx, crossX, 15, gold[4]);
  // Horizontal bar
  setPixel(ctx, crossX - 1, 14, gold[5]);
  setPixel(ctx, crossX + 1, 14, gold[5]);
  // Cross highlight
  setPixel(ctx, crossX, 13, gold[7]);

  // String from loop to cross
  drawLine(ctx, 7, 12, 7, 13, gold[3]);

  // Add a larger "Our Father" bead at cardinal points
  setPixel(ctx, 7, 2, gold[7]); // top center, brighter
  setPixel(ctx, 11, 7, gold[7]); // right
  setPixel(ctx, 3, 7, gold[7]); // left

  saveCanvas(canvas, path.join(ITEMS_DIR, 'rosary.png'));
}

function generateMedicinalHerbs() {
  console.log('Generating medicinal-herbs.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const jungle = PALETTE.jungle;
  const grass = PALETTE.grass;
  const wood = PALETTE.wood;
  const sand = PALETTE.sand;

  // Leaf bundle – several leaves spreading from a central tie point

  // Stems converging at center-bottom
  drawLine(ctx, 7, 10, 4, 3, grass[3]);
  drawLine(ctx, 7, 10, 7, 2, grass[3]);
  drawLine(ctx, 7, 10, 10, 3, grass[3]);
  drawLine(ctx, 7, 10, 3, 6, grass[3]);
  drawLine(ctx, 7, 10, 11, 5, grass[3]);

  // Leaf shapes – small ovals at stem tips
  // Leaf 1 (top-left)
  const leaves = [
    { cx: 4, cy: 3, color: jungle[6] },
    { cx: 7, cy: 2, color: grass[6] },
    { cx: 10, cy: 3, color: jungle[5] },
    { cx: 3, cy: 6, color: grass[5] },
    { cx: 11, cy: 5, color: jungle[6] },
  ];

  for (const leaf of leaves) {
    // Each leaf is a small 3x2 or 2x3 oval
    setPixel(ctx, leaf.cx, leaf.cy, leaf.color);
    setPixel(ctx, leaf.cx - 1, leaf.cy, leaf.color);
    setPixel(ctx, leaf.cx + 1, leaf.cy, leaf.color);
    setPixel(ctx, leaf.cx, leaf.cy - 1, leaf.color);
    setPixel(ctx, leaf.cx, leaf.cy + 1, lerpColor(leaf.color, jungle[3], 0.3));
    // Highlight
    setPixel(ctx, leaf.cx - 1, leaf.cy - 1, lerpColor(leaf.color, grass[7], 0.4));
  }

  // Extra leaf detail
  setPixel(ctx, 5, 4, grass[6]);
  setPixel(ctx, 9, 4, jungle[5]);
  setPixel(ctx, 6, 2, grass[5]);
  setPixel(ctx, 8, 2, jungle[6]);

  // Tie string (brown, wrapping around bundle base)
  for (let x = 5; x <= 9; x++) {
    setPixel(ctx, x, 10, sand[4]);
    setPixel(ctx, x, 11, sand[3]);
  }
  // String wrap detail
  setPixel(ctx, 6, 10, wood[5]);
  setPixel(ctx, 8, 10, wood[5]);
  setPixel(ctx, 7, 10, wood[6]);
  setPixel(ctx, 7, 11, wood[5]);

  // Hanging string tails
  setPixel(ctx, 6, 12, sand[3]);
  setPixel(ctx, 8, 12, sand[3]);
  setPixel(ctx, 5, 13, sand[2]);
  setPixel(ctx, 9, 13, sand[2]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'medicinal-herbs.png'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('=== Generating UI Assets ===\n');

  generateParchment();
  generateBorderCorner();
  generatePortraitFrame();

  console.log('');
  console.log('--- Carved-Chrome UI ---');
  generateDialogueBox();
  generatePanelParchment();
  generateInventorySlot();
  generateButton('default');
  generateButton('hover');
  generateButton('active');
  generateOrb('health-orb.png', PALETTE.clothRed, null);
  generateOrb('energy-orb.png', PALETTE.sky, PALETTE.gold);
  generateCoinIcon();
  generateJournalIcon();
  generateScrollTop();

  console.log('');
  console.log('--- Item Icons ---');
  generateTradingSeal();
  generateCoinPouch();
  generateSpiceSample();
  generateLetter();
  generateRosary();
  generateMedicinalHerbs();

  console.log('\nDone! All UI assets generated.');
}

main();
