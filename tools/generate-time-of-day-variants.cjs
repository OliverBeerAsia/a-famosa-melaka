/**
 * Time-of-Day Variant Generator
 *
 * Generates dawn/dusk/night versions of existing scene backgrounds
 * using color grading and lightweight atmospheric overlays.
 *
 * Run:
 *   node tools/generate-time-of-day-variants.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const SCENES_DIR = path.join(__dirname, '..', 'assets', 'scenes');

const BASE_SCENES = {
  'a-famosa': 'scene-a-famosa.png',
  'rua-direita': 'scene-rua-direita.png',
  'st-pauls': 'scene-st-pauls.png',
  waterfront: 'scene-waterfront.png',
  kampung: 'scene-kampung.png',
};

const VARIANTS = {
  dawn: {
    multiply: { color: '#f5b6a1', alpha: 0.24 },
    screen: { color: '#ffdcb2', alpha: 0.1 },
    gradient: {
      top: 'rgba(255, 170, 140, 0.32)',
      bottom: 'rgba(255, 228, 190, 0.05)',
    },
  },
  dusk: {
    multiply: { color: '#d88f4a', alpha: 0.26 },
    screen: { color: '#ffcb82', alpha: 0.08 },
    gradient: {
      top: 'rgba(255, 140, 60, 0.18)',
      bottom: 'rgba(120, 60, 20, 0.12)',
    },
  },
  night: {
    multiply: { color: '#2b3f7a', alpha: 0.4 },
    screen: { color: '#6f9ed8', alpha: 0.06 },
    gradient: {
      top: 'rgba(10, 18, 45, 0.25)',
      bottom: 'rgba(22, 35, 78, 0.18)',
    },
  },
};

function tint(ctx, width, height, color, alpha, mode) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function gradientOverlay(ctx, width, height, top, bottom, alpha = 1) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function addNightDetails(ctx, width, height, sceneName) {
  // Star field in sky area (top 1/3)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#cfe8ff';

  const stars = sceneName === 'waterfront' ? 50 : 36;
  for (let i = 0; i < stars; i++) {
    const x = Math.random() * width;
    const y = Math.random() * (height * 0.34);
    const size = Math.random() > 0.85 ? 2 : 1;
    ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
  }
  ctx.restore();

  // Warm window/lantern glows near lower-middle zones
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 22; i++) {
    const x = 80 + Math.random() * (width - 160);
    const y = height * 0.32 + Math.random() * (height * 0.5);
    const radius = 6 + Math.random() * 10;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, 'rgba(255, 214, 120, 0.95)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function addDawnMist(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * width;
    const y = height * 0.58 + Math.random() * (height * 0.35);
    const radiusX = 120 + Math.random() * 140;
    const radiusY = 28 + Math.random() * 36;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radiusX);
    gradient.addColorStop(0, 'rgba(215, 235, 255, 0.55)');
    gradient.addColorStop(1, 'rgba(215, 235, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

async function generateVariant(sceneName, baseFilename, variantName, variantConfig) {
  const inputPath = path.join(SCENES_DIR, baseFilename);
  const outputPath = path.join(SCENES_DIR, `scene-${sceneName}-${variantName}.png`);

  const source = await loadImage(inputPath);
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(source, 0, 0);

  gradientOverlay(
    ctx,
    canvas.width,
    canvas.height,
    variantConfig.gradient.top,
    variantConfig.gradient.bottom
  );
  tint(
    ctx,
    canvas.width,
    canvas.height,
    variantConfig.multiply.color,
    variantConfig.multiply.alpha,
    'multiply'
  );
  tint(
    ctx,
    canvas.width,
    canvas.height,
    variantConfig.screen.color,
    variantConfig.screen.alpha,
    'screen'
  );

  if (variantName === 'dawn') {
    addDawnMist(ctx, canvas.width, canvas.height);
  }
  if (variantName === 'night') {
    addNightDetails(ctx, canvas.width, canvas.height, sceneName);
  }

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`Generated: ${path.basename(outputPath)}`);
}

async function run() {
  if (!fs.existsSync(SCENES_DIR)) {
    throw new Error(`Missing scene directory: ${SCENES_DIR}`);
  }

  for (const [sceneName, baseFilename] of Object.entries(BASE_SCENES)) {
    const sourcePath = path.join(SCENES_DIR, baseFilename);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Skipping ${sceneName}; missing base file ${baseFilename}`);
      continue;
    }

    for (const [variantName, config] of Object.entries(VARIANTS)) {
      // eslint-disable-next-line no-await-in-loop
      await generateVariant(sceneName, baseFilename, variantName, config);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
