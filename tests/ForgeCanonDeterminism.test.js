import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas } = require('canvas');
const { compareDecodedPngs } = require('../tools/forge/validate-canon.cjs');

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-canon-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writePng(name, width, height, rgba, pngOptions) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  image.data.set(rgba);
  context.putImageData(image, 0, 0);
  const file = path.join(tmp, name);
  fs.writeFileSync(file, canvas.toBuffer('image/png', pngOptions));
  return file;
}

describe('forge canon decoded-PNG determinism', () => {
  test('accepts differently encoded PNG containers with identical pixels', async () => {
    const pixels = Uint8ClampedArray.from([12, 34, 56, 255, 78, 90, 123, 0]);
    const expected = writePng('expected.png', 2, 1, pixels, { compressionLevel: 0 });
    const actual = writePng('actual.png', 2, 1, pixels, { compressionLevel: 9 });

    expect(fs.readFileSync(expected).equals(fs.readFileSync(actual))).toBe(false);
    await expect(compareDecodedPngs(expected, actual)).resolves.toEqual({ equal: true });
  });

  test('rejects an exact decoded pixel or alpha difference', async () => {
    const expected = writePng('expected.png', 1, 1, Uint8ClampedArray.from([0, 0, 0, 255]));
    const actual = writePng('actual.png', 1, 1, Uint8ClampedArray.from([0, 0, 0, 254]));

    await expect(compareDecodedPngs(expected, actual)).resolves.toMatchObject({
      equal: false,
      reason: expect.stringContaining('alpha: 255 vs 254'),
    });
  });

  test('rejects an exact decoded colour-channel difference', async () => {
    const expected = writePng('expected.png', 1, 1, Uint8ClampedArray.from([12, 34, 56, 255]));
    const actual = writePng('actual.png', 1, 1, Uint8ClampedArray.from([13, 34, 56, 255]));

    await expect(compareDecodedPngs(expected, actual)).resolves.toMatchObject({
      equal: false,
      reason: expect.stringContaining('red: 12 vs 13'),
    });
  });

  test('rejects a dimension change even when pixels overlap', async () => {
    const expected = writePng('expected.png', 1, 1, Uint8ClampedArray.from([12, 34, 56, 255]));
    const actual = writePng('actual.png', 2, 1, Uint8ClampedArray.from([12, 34, 56, 255, 12, 34, 56, 255]));

    await expect(compareDecodedPngs(expected, actual)).resolves.toEqual({
      equal: false,
      reason: 'dimensions differ (1x1 vs 2x1)',
    });
  });
});
