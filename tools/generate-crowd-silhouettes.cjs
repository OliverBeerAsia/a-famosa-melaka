#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE } = require('./ultima8-graphics/palette.cjs');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'crowd');
const WIDTH = 8;
const HEIGHT = 16;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function saveSprite(name, draw) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  draw(ctx);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), canvas.toBuffer('image/png'));
  console.log(`  OK: ${name}.png (${WIDTH}x${HEIGHT})`);
}

function drawPortugueseMerchant(ctx) {
  rect(ctx, 2, 1, 4, 3, PALETTE.skinPortuguese[5]);
  rect(ctx, 1, 4, 6, 2, PALETTE.clothRed[4]);
  rect(ctx, 1, 6, 6, 6, PALETTE.clothBlue[4]);
  rect(ctx, 2, 12, 1, 3, PALETTE.wood[5]);
  rect(ctx, 5, 12, 1, 3, PALETTE.wood[5]);
}

function drawPortugueseGuard(ctx) {
  rect(ctx, 2, 0, 4, 2, PALETTE.shadow[5]);
  px(ctx, 1, 1, PALETTE.shadow[5]);
  px(ctx, 6, 1, PALETTE.shadow[5]);
  rect(ctx, 2, 2, 4, 3, PALETTE.skinPortuguese[4]);
  rect(ctx, 1, 5, 6, 5, PALETTE.stone[6]);
  rect(ctx, 2, 10, 1, 4, PALETTE.wood[5]);
  rect(ctx, 5, 10, 1, 4, PALETTE.wood[5]);
  rect(ctx, 7, 4, 1, 10, PALETTE.wood[6]);
}

function drawPortugueseWorker(ctx) {
  rect(ctx, 2, 1, 4, 2, PALETTE.wood[4]);
  rect(ctx, 2, 3, 4, 3, PALETTE.skinPortuguese[4]);
  rect(ctx, 1, 6, 6, 5, PALETTE.wood[5]);
  rect(ctx, 2, 11, 1, 4, PALETTE.sand[6]);
  rect(ctx, 5, 11, 1, 4, PALETTE.sand[6]);
}

function drawPortuguesePriest(ctx) {
  rect(ctx, 2, 1, 4, 3, PALETTE.skinPortuguese[4]);
  px(ctx, 3, 1, PALETTE.shadow[0]);
  px(ctx, 4, 1, PALETTE.shadow[0]);
  rect(ctx, 1, 4, 6, 9, PALETTE.shadow[2]);
  rect(ctx, 2, 13, 1, 2, PALETTE.shadow[3]);
  rect(ctx, 5, 13, 1, 2, PALETTE.shadow[3]);
}

function drawMalayLocal(ctx) {
  rect(ctx, 2, 2, 4, 3, PALETTE.skinMalay[5]);
  rect(ctx, 1, 5, 6, 4, PALETTE.jungle[6]);
  rect(ctx, 1, 9, 6, 4, PALETTE.turmericYellow[5]);
  rect(ctx, 2, 13, 1, 2, PALETTE.skinMalay[4]);
  rect(ctx, 5, 13, 1, 2, PALETTE.skinMalay[4]);
}

function drawMalayWoman(ctx) {
  rect(ctx, 1, 1, 6, 2, PALETTE.clothBlue[5]);
  rect(ctx, 2, 3, 4, 3, PALETTE.skinMalay[5]);
  rect(ctx, 1, 6, 6, 7, PALETTE.indigo[5]);
  rect(ctx, 2, 13, 1, 2, PALETTE.skinMalay[4]);
  rect(ctx, 5, 13, 1, 2, PALETTE.skinMalay[4]);
}

function drawMalayChild(ctx) {
  rect(ctx, 2, 4, 4, 3, PALETTE.skinMalay[5]);
  rect(ctx, 2, 7, 4, 4, PALETTE.jungle[6]);
  rect(ctx, 2, 11, 1, 3, PALETTE.skinMalay[4]);
  rect(ctx, 5, 11, 1, 3, PALETTE.skinMalay[4]);
}

function drawChineseMerchant(ctx) {
  rect(ctx, 2, 1, 4, 3, PALETTE.skinChinese[5]);
  px(ctx, 3, 0, PALETTE.shadow[2]);
  px(ctx, 4, 0, PALETTE.shadow[2]);
  rect(ctx, 1, 4, 6, 8, PALETTE.clothSilk[5]);
  rect(ctx, 2, 12, 1, 3, PALETTE.skinChinese[4]);
  rect(ctx, 5, 12, 1, 3, PALETTE.skinChinese[4]);
}

function drawArabTrader(ctx) {
  rect(ctx, 1, 1, 6, 2, PALETTE.whitewash[6]);
  rect(ctx, 2, 3, 4, 3, PALETTE.skinMalay[4]);
  rect(ctx, 1, 6, 6, 7, PALETTE.whitewash[5]);
  rect(ctx, 2, 13, 1, 2, PALETTE.sand[6]);
  rect(ctx, 5, 13, 1, 2, PALETTE.sand[6]);
}

function drawIndianMerchant(ctx) {
  rect(ctx, 1, 1, 6, 2, PALETTE.lacquerRed[5]);
  rect(ctx, 2, 3, 4, 3, PALETTE.skinIndian[5]);
  rect(ctx, 1, 6, 6, 6, PALETTE.indigo[6]);
  rect(ctx, 2, 12, 1, 3, PALETTE.skinIndian[4]);
  rect(ctx, 5, 12, 1, 3, PALETTE.skinIndian[4]);
}

function main() {
  ensureDir(OUT_DIR);
  console.log('Generating crowd silhouettes...');

  saveSprite('portuguese', drawPortugueseMerchant);
  saveSprite('portuguese-guard', drawPortugueseGuard);
  saveSprite('portuguese-worker', drawPortugueseWorker);
  saveSprite('portuguese-priest', drawPortuguesePriest);
  saveSprite('malay', drawMalayLocal);
  saveSprite('malay-woman', drawMalayWoman);
  saveSprite('malay-child', drawMalayChild);
  saveSprite('chinese', drawChineseMerchant);
  saveSprite('arab', drawArabTrader);
  saveSprite('indian', drawIndianMerchant);

  console.log('Done!');
}

main();
