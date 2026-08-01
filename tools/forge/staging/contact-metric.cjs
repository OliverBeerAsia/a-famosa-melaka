'use strict';
/**
 * BENCHMARK #17 — STRICT BOUNDARY-CONTRAST METRIC
 * ===============================================
 * The grayscale test, measured the way stage3 measures it rather than the way
 * it is easy to pass.
 *
 * For every WALKABLE pixel that touches a BLOCKED pixel (4-neighbourhood), take
 * the luminance of the walkable pixel and of the blocked neighbour it touches,
 * and report |dL| / 255. The gate is: the player must be able to see, locally,
 * where the ground stops. Global means (walls vs roofs averaged over the whole
 * frame) flatter a plate that has no contact definition at all, which is how
 * the accepted rua-direita plate scored well by eye and 8.5% by measurement.
 *
 * Reports mean separation and the share of boundary pixels clearing 25%.
 *
 *   node tools/forge/staging/contact-metric.cjs waterfront kampung
 *   node tools/forge/staging/contact-metric.cjs --all
 */

const path = require('path');
const fs = require('fs');
const { compose } = require('../compose-plate.cjs');

const LAYOUTS = path.resolve(__dirname, '../../../src/data/plate-layouts');

function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function measure(id) {
  const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, `${id}.json`), 'utf8'));
  const res = compose(layout, {});
  const { plate, walk } = res;
  const W = plate.width, H = plate.height;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return walk.data[(y * W + x) * 4] >= 128;
  };
  const L = (x, y) => {
    const i = (y * W + x) * 4;
    return luma(plate.data[i], plate.data[i + 1], plate.data[i + 2]);
  };

  let n = 0, sum = 0, pass = 0;
  const hist = new Array(10).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (walkable(x, y) !== true) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = walkable(x + dx, y + dy);
        if (nb !== false) continue;
        const sep = Math.abs(L(x, y) - L(x + dx, y + dy)) / 255;
        n++; sum += sep;
        if (sep >= 0.25) pass++;
        hist[Math.min(9, Math.floor(sep * 10))]++;
      }
    }
  }
  return {
    id, boundaryPixels: n,
    mean: n ? sum / n : 0,
    pass25: n ? pass / n : 0,
    hist: hist.map((c) => (n ? c / n : 0)),
  };
}

const argv = process.argv.slice(2);
const ids = argv.includes('--all')
  ? fs.readdirSync(LAYOUTS).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  : argv.filter((a) => !a.startsWith('--'));

console.log('benchmark #17 (strict, per-boundary-pixel)   gate: >=25% separation');
console.log('id                 boundary px    mean sep    %>=25%');
ids.forEach((id) => {
  const r = measure(id);
  const flag = r.pass25 >= 0.6 ? 'PASS' : r.pass25 >= 0.35 ? 'weak' : 'FAIL';
  console.log(
    `${id.padEnd(18)} ${String(r.boundaryPixels).padStart(9)}    ${(r.mean * 100).toFixed(1).padStart(6)}%    ${(r.pass25 * 100).toFixed(1).padStart(6)}%   ${flag}`
  );
  if (argv.includes('--hist')) {
    console.log('    hist ' + r.hist.map((v, i) => `${i * 10}-${i * 10 + 10}:${(v * 100).toFixed(0)}%`).join(' '));
  }
});
