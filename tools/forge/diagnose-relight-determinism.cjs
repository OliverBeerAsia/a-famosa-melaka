#!/usr/bin/env node
'use strict';

/**
 * Temporary CI diagnostic for the relight provenance baseline.
 *
 * It deliberately produces evidence rather than enforcing a policy: output is
 * regenerated in the OS temp directory, then compared to two tracked outputs
 * both as PNG bytes and as decoded RGBA pixels. It never writes assets/scenes.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const RP = require('./relight-plates.cjs');

const REPO = path.resolve(__dirname, '../..');
const SCENES = path.join(REPO, 'assets', 'scenes');
const TARGETS = [
  'scene-a-famosa.png',
  path.join('overlays', 'a-famosa-gate-fg-0.png'),
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function rgba(file) {
  const image = await loadImage(file);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
}

async function compare(relative, generatedRoot) {
  const committed = path.join(SCENES, relative);
  const generated = path.join(generatedRoot, relative);
  if (!fs.existsSync(committed) || !fs.existsSync(generated)) {
    throw new Error(`missing comparison file: ${relative}`);
  }

  const a = await rgba(committed);
  const b = await rgba(generated);
  let mismatchPixels = 0;
  let mismatchChannels = 0;
  let maxChannelDelta = 0;
  if (a.width === b.width && a.height === b.height) {
    for (let i = 0; i < a.data.length; i += 4) {
      let pixelMismatch = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(a.data[i + channel] - b.data[i + channel]);
        if (delta) {
          pixelMismatch = true;
          mismatchChannels++;
          if (delta > maxChannelDelta) maxChannelDelta = delta;
        }
      }
      if (pixelMismatch) mismatchPixels++;
    }
  } else {
    mismatchPixels = -1;
    mismatchChannels = -1;
  }

  console.log(JSON.stringify({
    target: `assets/scenes/${relative.split(path.sep).join('/')}`,
    committedSha256: sha256(committed),
    generatedSha256: sha256(generated),
    committedDimensions: `${a.width}x${a.height}`,
    generatedDimensions: `${b.width}x${b.height}`,
    rgbaMismatchPixels: mismatchPixels,
    rgbaMismatchChannels: mismatchChannels,
    maxChannelDelta,
  }));
}

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'a-famosa-relight-diagnostic-'));
  try {
    await RP.run({ only: ['a-famosa-gate'], outDir: output, writeDay: true });
    for (const target of TARGETS) {
      // Keep the output record ordered and machine-readable for CI log review.
      // eslint-disable-next-line no-await-in-loop
      await compare(target, output);
    }
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
