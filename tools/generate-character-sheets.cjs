/**
 * Character Sheet Generator
 *
 * Generates 16x32 character sprites and 64x128 sprite sheets
 * (4 directions x 4 animation frames).
 *
 * Run:
 *   node tools/generate-character-sheets.cjs
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

const CHARACTERS = {
  player: {
    skin: '#d2a07a',
    hair: '#4a2f1d',
    cloth: '#5f4b3d',
    cloth2: '#3e3d52',
    accent: '#b69458',
    outline: '#19140f',
  },
  'fernao-gomes': {
    skin: '#cf9b77',
    hair: '#26211b',
    cloth: '#5b2d2c',
    cloth2: '#41252a',
    accent: '#c9a249',
    outline: '#1b1310',
    ruff: '#efe7d7',
  },
  'capitao-rodrigues': {
    skin: '#c58f66',
    hair: '#3a2b21',
    cloth: '#4c5264',
    cloth2: '#2f3340',
    accent: '#be2a2a',
    outline: '#111317',
    helmet: '#8f97a5',
  },
  'padre-tomas': {
    skin: '#cca582',
    hair: '#4f3a2a',
    cloth: '#252525',
    cloth2: '#161616',
    accent: '#e5dfcc',
    outline: '#0d0d0d',
  },
  aminah: {
    skin: '#b7845d',
    hair: '#261f18',
    cloth: '#4f7b4f',
    cloth2: '#835774',
    accent: '#d4ad3d',
    outline: '#16120f',
    scarf: '#d8bb98',
  },
  'chen-wei': {
    skin: '#d8b493',
    hair: '#1d1a18',
    cloth: '#2a4f73',
    cloth2: '#1d3348',
    accent: '#c59c45',
    outline: '#121416',
    cap: '#222020',
  },
  rashid: {
    skin: '#b98158',
    hair: '#1f1b17',
    cloth: '#dbd7ca',
    cloth2: '#5b4b3f',
    accent: '#b43b2a',
    outline: '#181412',
    wrap: '#e7e1d3',
  },
};

const DIRECTIONS = ['down', 'left', 'right', 'up'];
const STRIDE = [0, 1, 0, -1];
const BOB = [0, 1, 0, 1];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function part(ctx, x, y, w, h, fill, outline) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, outline);
  rect(ctx, x, y, w, h, fill);
}

function drawEyes(ctx, x, y, dir, frame, color) {
  const blink = frame === 2;
  if (dir === 'up') return;
  if (dir === 'down') {
    rect(ctx, x + 1, y + 2, 1, blink ? 1 : 2, color);
    rect(ctx, x + 4, y + 2, 1, blink ? 1 : 2, color);
    return;
  }
  if (dir === 'left') {
    rect(ctx, x + 1, y + 2, 1, blink ? 1 : 2, color);
  } else {
    rect(ctx, x + 4, y + 2, 1, blink ? 1 : 2, color);
  }
}

function drawHead(ctx, ox, oy, colors, dir, frame) {
  if (dir === 'left' || dir === 'right') {
    part(ctx, ox + 5, oy + 4, 5, 6, colors.skin, colors.outline);
    part(ctx, ox + 5, oy + 3, 5, 2, colors.hair, colors.outline);
    drawEyes(ctx, ox + 5, oy + 4, dir, frame, colors.outline);
    return;
  }

  part(ctx, ox + 5, oy + 4, 6, 6, colors.skin, colors.outline);
  if (dir === 'up') {
    part(ctx, ox + 5, oy + 3, 6, 3, colors.hair, colors.outline);
  } else {
    part(ctx, ox + 5, oy + 3, 6, 2, colors.hair, colors.outline);
    drawEyes(ctx, ox + 5, oy + 4, dir, frame, colors.outline);
  }
}

function drawBodyFront(ctx, ox, oy, colors, frame, dir, characterId) {
  const stride = STRIDE[frame];
  const armSwing = -stride;

  part(ctx, ox + 5, oy + 11, 6, 8, colors.cloth, colors.outline);
  rect(ctx, ox + 5, oy + 16, 6, 2, colors.accent);

  part(ctx, ox + 3, oy + 12 + armSwing, 2, 6, colors.cloth, colors.outline);
  part(ctx, ox + 11, oy + 12 - armSwing, 2, 6, colors.cloth, colors.outline);

  part(ctx, ox + 6, oy + 19 + stride, 2, 8, colors.cloth2, colors.outline);
  part(ctx, ox + 9, oy + 19 - stride, 2, 8, colors.cloth2, colors.outline);

  rect(ctx, ox + 6, oy + 27 + stride, 2, 2, colors.outline);
  rect(ctx, ox + 9, oy + 27 - stride, 2, 2, colors.outline);

  if (characterId === 'fernao-gomes' && colors.ruff) {
    rect(ctx, ox + 5, oy + 10, 6, 1, colors.ruff);
  }

  if (characterId === 'capitao-rodrigues' && colors.helmet) {
    part(ctx, ox + 4, oy + 1, 8, 3, colors.helmet, colors.outline);
    rect(ctx, ox + 7, oy, 2, 1, colors.helmet);
    rect(ctx, ox + 5, oy + 13, 1, 8, colors.accent);
  }

  if (characterId === 'padre-tomas') {
    part(ctx, ox + 5, oy + 19, 6, 10, colors.cloth, colors.outline);
    rect(ctx, ox + 7, oy + 11, 2, 1, colors.accent);
    rect(ctx, ox + 8, oy + 12, 1, 4, colors.accent);
  }

  if (characterId === 'aminah' && colors.scarf) {
    part(ctx, ox + 4, oy + 3, 8, 3, colors.scarf, colors.outline);
    rect(ctx, ox + 5, oy + 20, 6, 2, colors.cloth2);
  }

  if (characterId === 'chen-wei' && colors.cap) {
    part(ctx, ox + 5, oy + 2, 6, 2, colors.cap, colors.outline);
    rect(ctx, ox + 5, oy + 14, 6, 1, colors.accent);
  }

  if (characterId === 'rashid' && colors.wrap) {
    part(ctx, ox + 4, oy + 2, 8, 3, colors.wrap, colors.outline);
    rect(ctx, ox + 5, oy + 17, 6, 1, colors.accent);
  }

  if (dir === 'up') {
    rect(ctx, ox + 5, oy + 11, 6, 2, colors.cloth2);
    rect(ctx, ox + 6, oy + 20, 4, 2, colors.cloth2);
  }
}

function drawBodySide(ctx, ox, oy, colors, frame, dir, characterId) {
  const stride = STRIDE[frame];

  part(ctx, ox + 5, oy + 11, 5, 8, colors.cloth, colors.outline);
  rect(ctx, ox + 5, oy + 16, 5, 1, colors.accent);

  if (dir === 'left') {
    part(ctx, ox + 4, oy + 12 - stride, 2, 6, colors.cloth, colors.outline);
    part(ctx, ox + 8, oy + 12 + stride, 2, 5, colors.cloth, colors.outline);
  } else {
    part(ctx, ox + 9, oy + 12 + stride, 2, 6, colors.cloth, colors.outline);
    part(ctx, ox + 6, oy + 12 - stride, 2, 5, colors.cloth, colors.outline);
  }

  part(ctx, ox + 6, oy + 19 + stride, 2, 8, colors.cloth2, colors.outline);
  part(ctx, ox + 8, oy + 19 - stride, 2, 7, colors.cloth2, colors.outline);
  rect(ctx, ox + 6, oy + 27 + stride, 4, 2, colors.outline);

  if (characterId === 'capitao-rodrigues' && colors.helmet) {
    part(ctx, ox + 4, oy + 1, 7, 3, colors.helmet, colors.outline);
  }
  if (characterId === 'aminah' && colors.scarf) {
    part(ctx, ox + 4, oy + 3, 7, 3, colors.scarf, colors.outline);
  }
  if (characterId === 'rashid' && colors.wrap) {
    part(ctx, ox + 4, oy + 2, 7, 3, colors.wrap, colors.outline);
  }
}

function drawFrame(ctx, characterId, colors, direction, frame, offsetX, offsetY) {
  const bob = BOB[frame];
  const ox = offsetX;
  const oy = offsetY + bob;

  // Ground shadow
  ctx.globalAlpha = 0.35;
  rect(ctx, ox + 4, oy + 29, 8, 2, '#000000');
  ctx.globalAlpha = 1;

  drawHead(ctx, ox, oy, colors, direction, frame);

  if (direction === 'left' || direction === 'right') {
    drawBodySide(ctx, ox, oy, colors, frame, direction, characterId);
  } else {
    drawBodyFront(ctx, ox, oy, colors, frame, direction, characterId);
  }
}

function generateSheet(characterId, colors) {
  const canvas = createCanvas(64, 128);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  DIRECTIONS.forEach((direction, row) => {
    for (let frame = 0; frame < 4; frame += 1) {
      drawFrame(ctx, characterId, colors, direction, frame, frame * 16, row * 32);
    }
  });

  return canvas.toBuffer('image/png');
}

function generateSingle(characterId, colors) {
  const canvas = createCanvas(16, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFrame(ctx, characterId, colors, 'down', 0, 0, 0);
  return canvas.toBuffer('image/png');
}

function run() {
  ensureDir(OUT_DIR);

  Object.entries(CHARACTERS).forEach(([characterId, colors]) => {
    const sheetBuffer = generateSheet(characterId, colors);
    const singleBuffer = generateSingle(characterId, colors);

    fs.writeFileSync(path.join(OUT_DIR, `${characterId}-sheet.png`), sheetBuffer);
    fs.writeFileSync(path.join(OUT_DIR, `${characterId}.png`), singleBuffer);
    console.log(`Generated ${characterId}-sheet.png and ${characterId}.png`);
  });

  // Generic NPC fallback
  fs.writeFileSync(
    path.join(OUT_DIR, 'npc.png'),
    generateSingle('player', CHARACTERS.player)
  );
  console.log('Generated npc.png');
}

run();
