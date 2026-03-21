/**
 * pixel-analysis.cjs
 *
 * Shared pixel-level analysis functions used by validate-style.cjs
 * and grade-wave-assets.cjs.  All functions accept a file path and
 * return a numeric score or null when the canvas module is unavailable.
 */

const fs = require('fs');
const path = require('path');

let canvasAvailable = true;
let createCanvas, loadImage;
try {
  ({ createCanvas, loadImage } = require('canvas'));
} catch {
  canvasAvailable = false;
}

function isCanvasAvailable() {
  return canvasAvailable;
}

async function loadImageData(filePath) {
  const image = await loadImage(filePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    imageData: ctx.getImageData(0, 0, image.width, image.height),
  };
}

/**
 * Returns the ratio of partial-alpha edge pixels to total edge pixels.
 * 0 = perfectly hard edges, >0.02 = noticeable anti-aliasing.
 */
async function detectAntiAliasing(filePath) {
  if (!canvasAvailable) return null;
  try {
    const { width, height, imageData } = await loadImageData(filePath);
    const { data } = imageData;

    let edgePixels = 0;
    let partialAlphaEdge = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha === 0) continue;

        let onEdge = false;
        const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            onEdge = true;
            break;
          }
          if (data[(ny * width + nx) * 4 + 3] === 0) {
            onEdge = true;
            break;
          }
        }

        if (onEdge) {
          edgePixels++;
          if (alpha > 0 && alpha < 255) partialAlphaEdge++;
        }
      }
    }

    if (edgePixels === 0) return 0;
    return partialAlphaEdge / edgePixels;
  } catch {
    return null;
  }
}

/**
 * Returns the ratio of scanlines that contain smooth gradient runs
 * exceeding maxRun consecutive low-delta pixels.
 */
async function detectSmoothGradients(filePath, maxRun) {
  if (!canvasAvailable) return null;
  try {
    const { width, height, imageData } = await loadImageData(filePath);
    const { data } = imageData;

    let smoothRuns = 0;
    let totalScanlines = 0;

    for (let y = 0; y < height; y++) {
      let runLength = 0;
      totalScanlines++;
      for (let x = 1; x < width; x++) {
        const idx1 = (y * width + (x - 1)) * 4;
        const idx2 = (y * width + x) * 4;
        if (data[idx1 + 3] === 0 || data[idx2 + 3] === 0) {
          runLength = 0;
          continue;
        }
        const dr = data[idx2] - data[idx1];
        const dg = data[idx2 + 1] - data[idx1 + 1];
        const db = data[idx2 + 2] - data[idx1 + 2];
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist > 0 && dist < 8) {
          runLength++;
          if (runLength >= maxRun) {
            smoothRuns++;
            runLength = 0;
          }
        } else {
          runLength = 0;
        }
      }
    }

    if (totalScanlines === 0) return 0;
    return smoothRuns / totalScanlines;
  } catch {
    return null;
  }
}

/**
 * Returns the number of distinct quantized color buckets (4-bit per channel).
 * VGA-grade portraits typically have 4-256 distinct buckets.
 */
async function analyzePortraitClusters(filePath) {
  if (!canvasAvailable) return null;
  try {
    const { imageData } = await loadImageData(filePath);
    const { data } = imageData;

    const buckets = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      buckets.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
    }

    return buckets.size;
  } catch {
    return null;
  }
}

/**
 * Returns the count of opaque pixels whose color is not in the palette set.
 * paletteSet should be a Set of uppercase hex strings like "#8B7355".
 */
async function checkPaletteCompliance(filePath, paletteSet) {
  if (!canvasAvailable) return null;
  try {
    const { imageData } = await loadImageData(filePath);
    const { data } = imageData;

    let nonPalettePixels = 0;
    let totalOpaquePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      totalOpaquePixels++;
      const hex = `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      if (!paletteSet.has(hex)) nonPalettePixels++;
    }

    return { nonPalettePixels, totalOpaquePixels };
  } catch {
    return null;
  }
}

/**
 * Returns a confidence score (0-1) that shadows fall south-east.
 * Compares the centroid of dark pixels vs. light pixels;
 * SE shadows mean dark pixels should cluster below-right of light ones.
 */
async function checkShadowDirection(filePath) {
  if (!canvasAvailable) return null;
  try {
    const { width, height, imageData } = await loadImageData(filePath);
    const { data } = imageData;

    let darkSumX = 0, darkSumY = 0, darkCount = 0;
    let lightSumX = 0, lightSumY = 0, lightCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) continue;
        const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (luminance < 80) {
          darkSumX += x; darkSumY += y; darkCount++;
        } else if (luminance > 160) {
          lightSumX += x; lightSumY += y; lightCount++;
        }
      }
    }

    if (darkCount === 0 || lightCount === 0) return null;

    const darkCX = darkSumX / darkCount;
    const darkCY = darkSumY / darkCount;
    const lightCX = lightSumX / lightCount;
    const lightCY = lightSumY / lightCount;

    // SE shadow: dark centroid should be right and below light centroid
    const dx = darkCX - lightCX;
    const dy = darkCY - lightCY;

    // Score: 1.0 if perfectly SE (45°), 0.0 if opposite
    const angle = Math.atan2(dy, dx); // SE = ~0.785 radians (45°)
    const targetAngle = Math.PI / 4; // 45° = SE
    const angleDiff = Math.abs(angle - targetAngle);
    const score = Math.max(0, 1 - angleDiff / Math.PI);

    return score;
  } catch {
    return null;
  }
}

module.exports = {
  isCanvasAvailable,
  detectAntiAliasing,
  detectSmoothGradients,
  analyzePortraitClusters,
  checkPaletteCompliance,
  checkShadowDirection,
};
