const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'assets', 'scenes');

const WIDTH = 960;
const HEIGHT = 540;

function coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight, anchorX = 0.5, anchorY = 0.5) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) * anchorX,
    y: (targetHeight - height) * anchorY,
    width,
    height,
  };
}

function colorGrade(ctx, width, height, options) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const {
    warmth = 1.08,
    contrast = 1.12,
    brightness = 0.92,
    sepia = 0.16,
  } = options;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const sr = (r * 0.393) + (g * 0.769) + (b * 0.189);
    const sg = (r * 0.349) + (g * 0.686) + (b * 0.168);
    const sb = (r * 0.272) + (g * 0.534) + (b * 0.131);

    r = r * (1 - sepia) + sr * sepia;
    g = g * (1 - sepia) + sg * sepia;
    b = b * (1 - sepia) + sb * sepia;

    r = ((r - 128) * contrast + 128) * brightness * warmth;
    g = ((g - 128) * contrast + 128) * brightness * 1.02;
    b = ((b - 128) * contrast + 128) * brightness * 0.88;

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(image, 0, 0);
}

function addVignette(ctx, width, height, alpha = 0.6) {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.18,
    width * 0.5,
    height * 0.5,
    width * 0.72,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.68, `rgba(8,5,3,${alpha * 0.42})`);
  gradient.addColorStop(1, `rgba(8,5,3,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

async function buildScreen({ source, output, anchorX, anchorY, grade, vignette }) {
  const image = await loadImage(source);
  const full = createCanvas(WIDTH, HEIGHT);
  const fullCtx = full.getContext('2d');
  fullCtx.imageSmoothingEnabled = true;
  fullCtx.imageSmoothingQuality = 'high';

  const rect = coverRect(image.width, image.height, WIDTH, HEIGHT, anchorX, anchorY);
  fullCtx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  colorGrade(fullCtx, WIDTH, HEIGHT, grade);
  addVignette(fullCtx, WIDTH, HEIGHT, vignette);

  fs.writeFileSync(output, full.toBuffer('image/png'));
  console.log(`Wrote ${path.relative(repoRoot, output)}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await buildScreen({
    source: path.join(repoRoot, 'docs', 'art-bible', 'source-art', 'vista-terreiro-paco-xviii.png'),
    output: path.join(outDir, 'opening-screen.png'),
    anchorX: 0.5,
    anchorY: 0.5,
    grade: { warmth: 1.03, contrast: 1.08, brightness: 0.82, sepia: 0.16 },
    vignette: 0.58,
  });

  await buildScreen({
    source: path.join(repoRoot, 'docs', 'art-bible', 'source-art', 'paco-ribeira-18th-century.jpg'),
    output: path.join(outDir, 'scene-loading-ribeira.png'),
    anchorX: 0.5,
    anchorY: 0.46,
    grade: { warmth: 1.04, contrast: 1.1, brightness: 0.82, sepia: 0.18 },
    vignette: 0.6,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
