'use strict';
/**
 * MELAKA FORGE — REMAP TO CANON
 * =============================
 * Salvages existing sprite sheets by remapping them onto the 50-colour canon,
 * so a character composited onto a Forge-relit plate belongs to the same world
 * as the plate. This is the "one sun, one world" rule applied to art that was
 * authored before the canon existed.
 *
 * WHY A NAIVE nearest() IS NOT ENOUGH
 * -----------------------------------
 * Per-pixel nearest-colour is a *lossy many-to-one* map. On a 16x32 sprite with
 * 20-odd colours, two adjacent shading steps regularly land on the SAME canon
 * entry — and the moment they do, the form they were describing (a cheekbone, a
 * fold, the lip of a hat) flattens out. Silhouette survives; readability does
 * not. Worse, the collapse is invisible in aggregate statistics: the sheet still
 * "uses 14 canon colours", it just uses them wrong.
 *
 * So the remap works on the sheet's COLOUR TABLE, not on its pixels:
 *   1. histogram the sheet's distinct source colours
 *   2. assign each a ramp, by voting over the whole sheet — every source colour
 *      is scored against every ramp and the winner is the ramp that owns the
 *      pixel mass, so a sprite's skin cannot drift half into terracotta
 *   3. within a ramp, map source colours to canon STEPS IN VALUE ORDER, and
 *      force adjacent distinct source colours onto DISTINCT steps whenever the
 *      source separated them by more than COLLAPSE_LUMA. That is the
 *      "protect 2-step separation" rule: contrast that existed in the source is
 *      never allowed to vanish, even if that means a slightly less accurate hue.
 *   4. only then rewrite pixels, through the table
 *
 * Alpha is hard-thresholded to {0, 255}: no anti-aliasing survives the trip.
 *
 * Deterministic: no Math.random, no Date.now. Same input -> same bytes.
 *
 * CLI
 *   node tools/forge/remap-canon.cjs                    crowd + characters
 *   node tools/forge/remap-canon.cjs --set crowd        one set
 *   node tools/forge/remap-canon.cjs --dry              report only
 *   node tools/forge/remap-canon.cjs --out /tmp/x       write elsewhere
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const P = require('./palette.cjs');

const REPO = path.resolve(__dirname, '../..');

/**
 * The migrated sets. Everything else (portraits, UI, tiles, objects, title and
 * loading screens) stays on the legacy palette for now and is listed in the
 * allowlist inside tools/forge/validate-canon.cjs — that list is meant to
 * SHRINK as later stages migrate each set.
 */
const SETS = {
  crowd: { dir: 'assets/sprites/crowd', match: /\.png$/ },
  characters: { dir: 'assets/sprites/characters', match: /-sheet\.png$/ },
};

// ---------------------------------------------------------------------------
// tuning
// ---------------------------------------------------------------------------
// Ramps a person can be made of. `sky` is atmosphere and never appears on a
// sprite; letting it into the pool turns blue cloth into a hole in the sky.
const SPRITE_RAMPS = ['whitewash', 'terracotta', 'stone', 'timber', 'foliage', 'water', 'earth', 'skin'];
// Accents as a DIRECT hit are for specular pings and metal glints only — a few
// pixels each. Anything larger goes through a virtual ramp instead (below).
const ACCENT_KEYS = ['flag-crimson', 'brass-gold', 'lantern-flame', 'sun-specular'];
const ACCENT_MAX_SHARE = 0.03;
const ACCENT_MAX_DIST = 30;

/**
 * VIRTUAL RAMPS — dyed cloth.
 *
 * The canon has 8 material ramps and 4 single-colour accents, and dyed cloth
 * falls between them: a Portuguese soldier's coat is *crimson*, but crimson is
 * one canon entry with no shading steps, so a naive remap either flattens the
 * coat to a single flat red or (what the first pass actually did) rejects the
 * accent for being too much of the sheet and drops the coat into `terracotta`,
 * turning every red uniform brown. Chen Wei's red robe landed on `skin`.
 *
 * A virtual ramp is a shading ladder BUILT FROM CANON ENTRIES with the accent
 * as its base step — exactly the composition LEGACY_MAP describes
 * (`clothRed: { accent: 'flag-crimson', ramp: 'terracotta' }`). It introduces
 * no new colours; it just tells the mapper which canon entries form a coherent
 * ramp for a dyed fabric. Listed dark -> light, and every one is monotonic in
 * luma so the step-separation pass below still works on it.
 */
const VIRTUAL_RAMPS = {
  // red uniforms, sashes, the Cross of Christ, lacquer
  crimson: ['terracotta-0', 'terracotta-1', 'flag-crimson', 'terracotta-3'],
  // brass buckles, gold braid, temple trim, turmeric-dyed cloth
  brass: ['timber-1', 'earth-2', 'brass-gold', 'earth-4'],
  // indigo — the canon's blue is `water`, whose light steps run to TEAL, so
  // blue cloth borrows the sky band above its midpoint instead of turning
  // every sarong and every pair of breeches cyan
  indigo: ['water-0', 'water-1', 'sky-1', 'sky-2'],
};
// Two source colours further apart than this in luma MUST NOT collapse onto one
// canon step — that is contrast the artist put there on purpose. Measured
// against the FIRST colour to claim a step, not the previous one: five shading
// steps 5 luma apart each are 20 luma of form in total, and comparing only
// neighbours let the whole span slide onto a single canon entry.
const COLLAPSE_LUMA = 10;
// Human skin is never this saturated. A source colour that is, but which the
// ramp vote wants to call skin, is dyed cloth being mistaken for a body — the
// crowd's maroon Chinese robe voted `skin` and the whole garment came back
// reading as bare flesh.
const SKIN_MAX_SAT = 0.58;
// Outlines: anything this dark is an outline and goes to an anchor, never to a
// material's mid step (which is what turns a crisp sprite into a blob).
const OUTLINE_LUMA = 26;

const RAMP_POOLS = (() => {
  const m = {};
  P.CANON.forEach((c) => { (m[c.ramp] = m[c.ramp] || []).push(c); });
  return m;
})();
const ANCHOR_POOL = RAMP_POOLS.anchor;
const ACCENT_POOL = P.CANON.filter((c) => ACCENT_KEYS.includes(c.name));

const BY_NAME = new Map(P.CANON.map((c) => [c.name, c]));
// resolved virtual ramps, verified monotonic in luma at load time
const VIRTUAL_POOLS = Object.fromEntries(Object.entries(VIRTUAL_RAMPS).map(([k, names]) => {
  const cols = names.map((n) => {
    const c = BY_NAME.get(n);
    if (!c) throw new Error(`virtual ramp ${k}: no canon colour named "${n}"`);
    return c;
  });
  for (let i = 1; i < cols.length; i++) {
    if (P.luma(cols[i].r, cols[i].g, cols[i].b) <= P.luma(cols[i - 1].r, cols[i - 1].g, cols[i - 1].b)) {
      throw new Error(`virtual ramp ${k} is not monotonic in luma at step ${i}`);
    }
  }
  return [k, cols];
}));

/** Every ramp a body colour may be assigned to. Real ramps win ties. */
const CANDIDATE_RAMPS = [
  ...SPRITE_RAMPS.map((k) => ({ key: k, pool: RAMP_POOLS[k] })),
  ...Object.keys(VIRTUAL_POOLS).map((k) => ({ key: k, pool: VIRTUAL_POOLS[k] })),
];

function dist2(a, r, g, b) {
  const dr = a.r - r, dg = a.g - g, db = a.b - b;
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

// ---------------------------------------------------------------------------
// the remap
// ---------------------------------------------------------------------------
/**
 * Build the source-colour -> canon-colour table for one sheet.
 * `hist` is Map<packedRGB, count>.
 */
function buildTable(hist) {
  const entries = [...hist.entries()]
    .map(([k, n]) => ({
      key: k, n,
      r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255,
    }))
    .sort((a, b) => (a.key - b.key));           // deterministic order
  entries.forEach((e) => { e.luma = P.luma(e.r, e.g, e.b); });
  const totalPx = entries.reduce((a, e) => a + e.n, 0);

  const table = new Map();
  const notes = [];

  // --- 1. outlines and accents come out first -----------------------------
  const body = [];
  entries.forEach((e) => {
    if (e.luma <= OUTLINE_LUMA) {
      // an outline is a hue-shifted dark, never #000 — the anchors are exactly
      // that, and using them means every sprite's outline belongs to the same
      // night as every plate's cast shadow
      let best = ANCHOR_POOL[0], bd = Infinity;
      ANCHOR_POOL.forEach((c) => { const d = dist2(c, e.r, e.g, e.b); if (d < bd) { bd = d; best = c; } });
      table.set(e.key, best);
      return;
    }
    let bestAccent = null, bd = Infinity;
    ACCENT_POOL.forEach((c) => { const d = dist2(c, e.r, e.g, e.b); if (d < bd) { bd = d; bestAccent = c; } });
    if (bestAccent && Math.sqrt(bd) <= ACCENT_MAX_DIST && e.n / totalPx <= ACCENT_MAX_SHARE) {
      table.set(e.key, bestAccent);
      return;
    }
    body.push(e);
  });

  // --- 2. vote each body colour onto a ramp -------------------------------
  const vote = (e, skip) => {
    let best = null, bd = Infinity;
    CANDIDATE_RAMPS.forEach(({ key, pool }) => {
      if (key === skip) return;
      let d = Infinity;
      pool.forEach((c) => { const dd = dist2(c, e.r, e.g, e.b); if (dd < d) d = dd; });
      if (d < bd) { bd = d; best = key; }   // strict <: real ramps are listed first and win ties
    });
    return best;
  };
  body.forEach((e) => {
    e.ramp = vote(e, null);
    if (e.ramp === 'skin' && P.rgbToHsv(e.r, e.g, e.b).s > SKIN_MAX_SAT) {
      e.ramp = vote(e, 'skin');
      notes.push(`${P.rgbToHex(e.r, e.g, e.b)} too saturated for skin -> ${e.ramp}`);
    }
  });

  // --- 3. per ramp: map in value order, protecting separation -------------
  const byRamp = {};
  body.forEach((e) => { (byRamp[e.ramp] = byRamp[e.ramp] || []).push(e); });

  Object.entries(byRamp).forEach(([rampKey, list]) => {
    const ramp = RAMP_POOLS[rampKey] || VIRTUAL_POOLS[rampKey];
    // darkest source colour first
    list.sort((a, b) => (a.luma - b.luma) || (a.key - b.key));

    // first pass: everyone takes their honest nearest step
    list.forEach((e) => {
      let bi = 0, bd = Infinity;
      ramp.forEach((c, i) => { const d = dist2(c, e.r, e.g, e.b); if (d < bd) { bd = d; bi = i; } });
      e.step = bi;
    });

    // second pass: walk light-ward and push any collapse apart. A source pair
    // the artist separated by more than COLLAPSE_LUMA must still be separated
    // after the remap, even at the cost of hue accuracy.
    let anchorLuma = list[0].luma;   // luma of the first colour to claim the current step
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      if (cur.step > prev.step) { anchorLuma = cur.luma; continue; }
      if (cur.luma - anchorLuma <= COLLAPSE_LUMA) { cur.step = prev.step; continue; }
      anchorLuma = cur.luma;
      const want = prev.step + 1;
      if (want < ramp.length) {
        cur.step = want;
        notes.push(`separated ${P.rgbToHex(cur.r, cur.g, cur.b)} from ${P.rgbToHex(prev.r, prev.g, prev.b)} -> ${rampKey}-${want}`);
      } else {
        // no headroom at the light end: push the DARKER one down instead
        for (let j = i - 1; j >= 0; j--) {
          if (list[j].step > 0 && list[j].step >= list[j + 1].step) list[j].step = list[j + 1].step - 1;
          if (list[j].step < 0) list[j].step = 0;
        }
        notes.push(`separated ${P.rgbToHex(cur.r, cur.g, cur.b)} downward in ${rampKey}`);
      }
    }

    list.forEach((e) => { table.set(e.key, ramp[P.clamp(e.step, 0, ramp.length - 1)]); });
  });

  return { table, notes };
}

async function remapFile(file, opts) {
  const img = await loadImage(file);
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, img.width, img.height);
  const d = id.data;

  const hist = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    hist.set(k, (hist.get(k) || 0) + 1);
  }

  const { table, notes } = buildTable(hist);

  const usedCanon = new Set();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {                        // hard alpha: no AA survives
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
      continue;
    }
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const c = table.get(k) || P.nearest(d[i], d[i + 1], d[i + 2]);
    d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255;
    usedCanon.add(c.index);
  }
  ctx.putImageData(id, 0, 0);

  const report = {
    file: path.relative(REPO, file),
    srcColours: hist.size,
    canonColours: usedCanon.size,
    collapsed: hist.size - usedCanon.size,
    notes,
  };

  if (!opts.dry) {
    const out = opts.outDir
      ? path.join(opts.outDir, path.basename(file))
      : file;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, cv.toBuffer('image/png'));
  }
  return report;
}

function filesForSet(name) {
  const set = SETS[name];
  const dir = path.join(REPO, set.dir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => set.match.test(f)).sort()
    .map((f) => path.join(dir, f));
}

async function run(opts = {}) {
  const sets = opts.sets && opts.sets.length ? opts.sets : Object.keys(SETS);
  const reports = [];
  for (const s of sets) {
    if (!SETS[s]) throw new Error(`unknown set "${s}" (have: ${Object.keys(SETS).join(', ')})`);
    for (const f of filesForSet(s)) {
      // eslint-disable-next-line no-await-in-loop
      reports.push({ set: s, ...(await remapFile(f, opts)) });
    }
  }
  return reports;
}

module.exports = { run, remapFile, buildTable, filesForSet, SETS, SPRITE_RAMPS };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = { sets: [], dry: false, outDir: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--set') { opts.sets.push(argv[++i]); continue; }
    if (argv[i] === '--out') { opts.outDir = path.resolve(argv[++i]); continue; }
    if (argv[i] === '--dry') { opts.dry = true; continue; }
  }
  run(opts).then((reports) => {
    let worst = 0;
    reports.forEach((r) => {
      console.log(
        `${r.file.padEnd(46)} ${String(r.srcColours).padStart(3)} -> ` +
        `${String(r.canonColours).padStart(2)} canon` +
        (r.collapsed ? `  (${r.collapsed} merged)` : '')
      );
      r.notes.slice(0, 3).forEach((n) => console.log('      ' + n));
      worst = Math.max(worst, r.collapsed / Math.max(1, r.srcColours));
    });
    console.log(`\n${reports.length} sprite(s) remapped${opts.dry ? ' (dry run)' : ''}`);
  }).catch((e) => { console.error(e); process.exit(1); });
}
