#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE } = require('./ultima8-graphics/palette.cjs');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'crowd');
const WIDTH = 16;
const HEIGHT = 32;

const S = PALETTE.shadow;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function px(ctx, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function ditherRect(ctx, x, y, w, h, palette, leftShade, rightShade) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const edge = xx < x + 2 ? leftShade + 1 : xx >= x + w - 2 ? rightShade : leftShade;
      const shade = ((xx + yy) % 4 === 0) ? Math.max(0, edge - 1) : edge;
      px(ctx, xx, yy, palette[Math.max(0, Math.min(7, shade))]);
    }
  }
}

function outlineRect(ctx, x, y, w, h) {
  rect(ctx, x - 1, y, 1, h, S[1]);
  rect(ctx, x + w, y, 1, h, S[0]);
  rect(ctx, x, y - 1, w, 1, S[1]);
  rect(ctx, x, y + h, w, 1, S[0]);
}

function drawFace(ctx, x, y, skin, hair = S) {
  outlineRect(ctx, x, y, 5, 6);
  ditherRect(ctx, x, y, 5, 6, skin, 5, 3);
  px(ctx, x + 1, y + 2, S[0]);
  px(ctx, x + 3, y + 2, S[0]);
  px(ctx, x + 2, y + 4, skin[2]);
  px(ctx, x, y - 1, hair[2]);
  px(ctx, x + 1, y - 2, hair[2]);
  px(ctx, x + 2, y - 2, hair[3]);
  px(ctx, x + 3, y - 2, hair[2]);
  px(ctx, x + 4, y - 1, hair[1]);
}

function drawLegs(ctx, leftX, y, palette, sandal = PALETTE.wood) {
  ditherRect(ctx, leftX, y, 3, 6, palette, 3, 2);
  ditherRect(ctx, leftX + 5, y, 3, 6, palette, 2, 1);
  rect(ctx, leftX, y + 6, 4, 1, sandal[4]);
  rect(ctx, leftX + 5, y + 6, 4, 1, sandal[3]);
}

function addSash(ctx, x, y, color) {
  px(ctx, x, y, color);
  px(ctx, x + 1, y + 1, color);
  px(ctx, x + 2, y + 2, color);
  px(ctx, x + 3, y + 3, color);
  px(ctx, x + 4, y + 4, color);
}

function addHands(ctx, skin, leftX, rightX, y) {
  px(ctx, leftX, y, skin[4]);
  px(ctx, leftX, y + 1, skin[3]);
  px(ctx, rightX, y, skin[2]);
  px(ctx, rightX, y + 1, skin[1]);
}

function addCrowdShadow(ctx) {
  const sh = PALETTE.shadow;
  const cx = 11;
  const cy = 30;
  const rx = 4;
  const ry = 1.5;
  for (let y = 29; y < 32; y++) {
    for (let x = 6; x < 16; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        px(ctx, x, y, sh[2]);
      }
    }
  }
}

function saveSprite(name, draw) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  addCrowdShadow(ctx);
  draw(ctx);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), canvas.toBuffer('image/png'));
  console.log(`  OK: ${name}.png (${WIDTH}x${HEIGHT})`);
}

function drawPortugueseMerchant(ctx) {
  const skin = PALETTE.skinPortuguese;
  const coat = PALETTE.clothRed;
  const hose = PALETTE.clothBlue;
  rect(ctx, 4, 2, 8, 2, S[2]); // felt brim
  rect(ctx, 6, 0, 4, 3, S[1]);
  px(ctx, 10, 1, PALETTE.gold[5]);
  drawFace(ctx, 6, 5, skin, PALETTE.wood);
  rect(ctx, 5, 11, 6, 2, PALETTE.whitewash[6]); // linen collar
  outlineRect(ctx, 4, 13, 8, 10);
  ditherRect(ctx, 4, 13, 8, 10, coat, 5, 2);
  addSash(ctx, 5, 14, PALETTE.gold[5]);
  rect(ctx, 2, 14, 2, 8, coat[4]);
  rect(ctx, 12, 14, 2, 8, coat[2]);
  addHands(ctx, skin, 2, 13, 22);
  drawLegs(ctx, 4, 24, hose);
}

function drawPortugueseGuard(ctx) {
  const skin = PALETTE.skinPortuguese;
  rect(ctx, 5, 2, 6, 2, PALETTE.stone[5]); // morion brim
  px(ctx, 7, 0, PALETTE.stone[6]);
  px(ctx, 8, 0, PALETTE.stone[6]);
  rect(ctx, 6, 1, 4, 3, PALETTE.stone[4]);
  drawFace(ctx, 6, 6, skin, PALETTE.stone);
  outlineRect(ctx, 4, 13, 8, 10);
  ditherRect(ctx, 4, 13, 8, 10, PALETTE.stone, 6, 3); // cuirass
  rect(ctx, 5, 14, 1, 8, PALETTE.specular[2]);
  rect(ctx, 10, 14, 1, 8, PALETTE.shadow[4]);
  rect(ctx, 12, 7, 1, 22, PALETTE.wood[5]); // halberd shaft
  px(ctx, 11, 5, PALETTE.stone[6]);
  px(ctx, 12, 4, PALETTE.stone[7]);
  px(ctx, 13, 5, PALETTE.stone[5]);
  drawLegs(ctx, 4, 24, PALETTE.clothRed);
}

function drawPortugueseWorker(ctx) {
  const skin = PALETTE.skinPortuguese;
  rect(ctx, 5, 2, 6, 2, PALETTE.thatch[4]);
  px(ctx, 6, 1, PALETTE.thatch[5]);
  px(ctx, 9, 1, PALETTE.thatch[3]);
  drawFace(ctx, 6, 5, skin, PALETTE.wood);
  outlineRect(ctx, 4, 13, 8, 9);
  ditherRect(ctx, 4, 13, 8, 9, PALETTE.whitewash, 4, 2);
  rect(ctx, 3, 14, 2, 8, PALETTE.skinPortuguese[4]);
  rect(ctx, 11, 14, 2, 8, PALETTE.skinPortuguese[2]);
  rect(ctx, 2, 18, 12, 2, PALETTE.wood[5]); // carrying pole
  px(ctx, 1, 19, PALETTE.wood[3]);
  px(ctx, 14, 19, PALETTE.wood[2]);
  drawLegs(ctx, 4, 23, PALETTE.sand);
}

function drawPortuguesePriest(ctx) {
  const skin = PALETTE.skinPortuguese;
  drawFace(ctx, 6, 5, skin, PALETTE.skinPortuguese);
  rect(ctx, 7, 3, 3, 1, S[0]); // tonsure crown
  outlineRect(ctx, 4, 12, 8, 15);
  ditherRect(ctx, 4, 12, 8, 15, PALETTE.shadow, 4, 1);
  rect(ctx, 7, 13, 2, 8, PALETTE.shadow[0]);
  px(ctx, 8, 15, PALETTE.gold[5]);
  px(ctx, 8, 16, PALETTE.gold[5]);
  px(ctx, 7, 16, PALETTE.gold[5]);
  px(ctx, 9, 16, PALETTE.gold[5]);
  rect(ctx, 3, 14, 1, 10, S[3]);
  rect(ctx, 12, 14, 1, 10, S[1]);
  drawLegs(ctx, 4, 27, PALETTE.shadow);
}

function drawMalayLocal(ctx) {
  const skin = PALETTE.skinMalay;
  rect(ctx, 5, 2, 6, 2, S[2]); // songkok
  rect(ctx, 6, 1, 4, 2, S[1]);
  drawFace(ctx, 6, 5, skin, S);
  outlineRect(ctx, 4, 13, 8, 9);
  ditherRect(ctx, 4, 13, 8, 9, PALETTE.jungle, 6, 3);
  rect(ctx, 5, 22, 6, 1, PALETTE.gold[4]);
  ditherRect(ctx, 4, 23, 8, 6, PALETTE.turmericYellow, 5, 2);
  px(ctx, 5, 24, PALETTE.clothBlue[5]);
  px(ctx, 8, 26, PALETTE.clothBlue[5]);
  px(ctx, 10, 24, PALETTE.clothBlue[3]);
  addHands(ctx, skin, 3, 12, 22);
  drawLegs(ctx, 4, 29, PALETTE.skinMalay);
}

function drawMalayWoman(ctx) {
  const skin = PALETTE.skinMalay;
  rect(ctx, 4, 1, 8, 4, PALETTE.clothBlue[5]); // tudung
  px(ctx, 4, 5, PALETTE.clothBlue[4]);
  px(ctx, 11, 5, PALETTE.clothBlue[2]);
  drawFace(ctx, 6, 6, skin, PALETTE.clothBlue);
  outlineRect(ctx, 4, 14, 8, 13);
  ditherRect(ctx, 4, 14, 8, 13, PALETTE.indigo, 6, 2);
  for (let y = 17; y <= 26; y += 3) {
    px(ctx, 5, y, PALETTE.turmericYellow[5]);
    px(ctx, 8, y + 1, PALETTE.turmericYellow[4]);
    px(ctx, 10, y, PALETTE.turmericYellow[3]);
  }
  rect(ctx, 2, 18, 2, 5, PALETTE.thatch[5]); // basket
  px(ctx, 2, 17, PALETTE.thatch[6]);
  addHands(ctx, skin, 3, 12, 23);
  drawLegs(ctx, 4, 27, PALETTE.indigo);
}

function drawMalayChild(ctx) {
  const skin = PALETTE.skinMalay;
  rect(ctx, 6, 5, 4, 2, S[1]);
  drawFace(ctx, 6, 8, skin, S);
  outlineRect(ctx, 5, 15, 6, 8);
  ditherRect(ctx, 5, 15, 6, 8, PALETTE.jungle, 6, 3);
  rect(ctx, 4, 16, 1, 5, skin[4]);
  rect(ctx, 11, 16, 1, 5, skin[2]);
  ditherRect(ctx, 5, 23, 6, 5, PALETTE.turmericYellow, 5, 2);
  drawLegs(ctx, 5, 27, PALETTE.skinMalay);
}

function drawChineseMerchant(ctx) {
  const skin = PALETTE.skinChinese;
  rect(ctx, 5, 2, 6, 2, S[2]); // scholar cap
  rect(ctx, 6, 1, 4, 2, S[1]);
  drawFace(ctx, 6, 5, skin, S);
  outlineRect(ctx, 4, 13, 8, 14);
  ditherRect(ctx, 4, 13, 8, 14, PALETTE.clothSilk, 6, 2);
  rect(ctx, 5, 14, 1, 12, PALETTE.gold[4]);
  rect(ctx, 10, 14, 1, 12, PALETTE.lacquerRed[4]);
  rect(ctx, 2, 16, 2, 8, PALETTE.clothSilk[5]);
  rect(ctx, 12, 16, 2, 8, PALETTE.clothSilk[2]);
  addHands(ctx, skin, 2, 13, 24);
  drawLegs(ctx, 4, 27, PALETTE.shadow);
}

function drawArabTrader(ctx) {
  const skin = PALETTE.skinMalay;
  rect(ctx, 4, 1, 8, 3, PALETTE.whitewash[6]); // turban
  px(ctx, 5, 0, PALETTE.whitewash[5]);
  px(ctx, 8, 0, PALETTE.whitewash[7]);
  px(ctx, 11, 2, PALETTE.whitewash[4]);
  drawFace(ctx, 6, 5, skin, PALETTE.whitewash);
  outlineRect(ctx, 4, 13, 8, 14);
  ditherRect(ctx, 4, 13, 8, 14, PALETTE.whitewash, 5, 2);
  addSash(ctx, 5, 16, PALETTE.clothRed[5]);
  rect(ctx, 2, 15, 2, 8, PALETTE.whitewash[4]);
  rect(ctx, 12, 15, 2, 8, PALETTE.whitewash[2]);
  addHands(ctx, skin, 2, 13, 23);
  drawLegs(ctx, 4, 27, PALETTE.sand);
}

function drawIndianMerchant(ctx) {
  const skin = PALETTE.skinIndian;
  rect(ctx, 4, 1, 8, 4, PALETTE.turmericYellow[5]); // pagri
  px(ctx, 5, 2, PALETTE.clothRed[5]);
  px(ctx, 8, 1, PALETTE.clothRed[4]);
  px(ctx, 10, 3, PALETTE.gold[6]);
  drawFace(ctx, 6, 6, skin, PALETTE.turmericYellow);
  for (let x = 6; x <= 9; x++) px(ctx, x, 11, S[2]); // moustache
  outlineRect(ctx, 4, 14, 8, 11);
  ditherRect(ctx, 4, 14, 8, 11, PALETTE.lacquerRed, 5, 2);
  addSash(ctx, 5, 15, PALETTE.gold[5]);
  ditherRect(ctx, 4, 25, 8, 4, PALETTE.sand, 7, 5);
  addHands(ctx, skin, 3, 12, 23);
  drawLegs(ctx, 4, 29, PALETTE.skinIndian);
}

function main() {
  ensureDir(OUT_DIR);
  console.log('Generating detailed 16x32 crowd sprites...');

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
