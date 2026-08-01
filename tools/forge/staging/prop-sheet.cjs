'use strict';
/**
 * Kit contact sheet — a scratch harness for judging one prop at a time.
 * Renders each named prop on a neutral ground with a 16x32 player silhouette
 * beside it, so scale and silhouette can be checked before a prop goes into a
 * layout. Staging only; never shipped.
 *
 *   node tools/forge/staging/prop-sheet.cjs junk dhow stilt-house
 */
const path = require('path');
const P = require('../palette.cjs');
const T = require('../texture.cjs');
const ISO = require('../iso.cjs');
const { Surface } = require('../surface.cjs');
const { PROPS } = require('../kits/props.cjs');

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
/** Per-prop overrides so runs that need geometry (a wall length, a hull) work. */
const SPECS = {
  junk: { len: 190 },
  dhow: { len: 140 },
  'fortress-wall': { len: 9, axis: 'h', h: 112, tx: -4, ty: 4, gate: { at: 0.5 }, towers: [{ at: 0.06, flag: true }] },
  'quay-edge': { len: 8, axis: 'h', tx: -4, ty: 4 },
  'kampung-fence': { len: 5, axis: 'h', tx: -2, ty: 2 },
  'piling-row': { count: 4 },
  'canopy-band': { y0: 20, y1: 120, x0: 0, x1: 240 },
};
const CELL_W = 240, CELL_H = 200;
const cols = Math.min(4, names.length);
const rows = Math.ceil(names.length / cols);
const S = new Surface(CELL_W * cols, CELL_H * rows);
S.clear(P.RAMPS.sky[1]);

names.forEach((name, i) => {
  const def = PROPS[name];
  if (!def) { console.error('unknown prop: ' + name); return; }
  const cx = (i % cols) * CELL_W, cy = Math.floor(i / cols) * CELL_H;
  const iso = ISO.createIso({ tileWidth: 32, tileHeight: 16, originX: cx + CELL_W / 2, originY: cy + CELL_H - 60 });
  // ground
  const g = T.dirt({ material: 'earth', light: 3 });
  for (let y = cy; y < cy + CELL_H; y++) {
    for (let x = cx; x < cx + CELL_W; x++) {
      const t = iso.toTile(x + 0.5, y + 0.5, 0);
      S.setHex(x, y, g(t.tx, t.ty, x, y));
    }
  }
  try {
    def.draw(S, iso, Object.assign({ tx: 0, ty: 0, seed: 7 + i * 3 }, SPECS[name] || {}));
  } catch (e) {
    console.error(name, e.message);
  }
  // player silhouette for scale (16x32 at the same ground line)
  const px = cx + 24, py = cy + CELL_H - 60;
  for (let v = 0; v < 32; v++) {
    for (let k = 0; k < 16; k++) S.setHex(px + k, py - v, v > 28 || k === 0 || k === 15 ? P.ANCHORS['shadow-void'] : P.ACCENTS['flag-crimson']);
  }
});
S.quantize(P);
const out = path.join(__dirname, 'prop-sheet.png');
S.scaleNearest(2).writePNG(out);
console.log('wrote ' + out);
