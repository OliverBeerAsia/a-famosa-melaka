'use strict';
/**
 * MELAKA FORGE — FAUNA SHEETS
 * ===========================
 * `assets/sprites/objects/fauna-<kind>-sheet.png` — horizontal strips, no
 * padding, left to right, native px, canon colours only.
 *
 * WHY THESE ARE TINY AND WHY THAT IS THE POINT
 * --------------------------------------------
 * Fauna exist to make the frame move when nothing is happening — Baldur's Gate
 * ambient indifference. They never react to the player, never block, never
 * carry dialogue. At 10-20 px they are read as SILHOUETTE plus one identifying
 * accent, so each one gets exactly three decisions: a readable outline, two
 * body values, and one colour that says what it is (a chicken's crimson comb,
 * a dove's terracotta beak). Anything more at this size turns to mud.
 *
 * THE THREE RULES THE ART TRACK SET, ENFORCED HERE
 *  - canon colours only, straight off `palette.cjs`;
 *  - a 1 px selective outline in the MATERIAL'S OWN step-0 hue, never #000;
 *  - a contact shadow on every ground-dwelling animal. Non-negotiable at our
 *    sprite scale: a fauna sprite without one reads as a decal lying on the
 *    plate rather than an animal standing on it (benchmark item 13).
 *
 * CONTACT SHADOWS ARE DITHERED, NOT ALPHA-BLENDED. A 35 %-alpha ellipse is the
 * obvious way and it is wrong twice: `validate-gameplay-assets.cjs` rejects
 * partial alpha on gameplay art, and a soft shadow under a hard-edged 12 px
 * sprite is a second pixel density. So the shadow is solid canon
 * `shadow-violet` at full alpha, ordered-dithered to ~45 % coverage.
 *
 * SPEC DEVIATION: §4.3 asks for the shadows to come from the shared pixel
 * contact-shadow sheet. That sheet is sized for 16x32 characters and is on the
 * art track; at 10-20 px these need their own, so the shadow is baked into
 * each frame. It therefore does not rotate with the hour — at this size the
 * shadow is 3 px of dither and the difference is not visible, but it is a real
 * simplification and it is written down here rather than discovered later.
 *
 * DETERMINISTIC: no Math.random, no Date.now.
 *
 * CLI
 *   node tools/forge/fauna-sheets.cjs            # write every sheet
 *   node tools/forge/fauna-sheets.cjs --out DIR
 */

const fs = require('fs');
const path = require('path');

const P = require('./palette.cjs');
const { Surface } = require('./surface.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'assets', 'sprites', 'objects');

// canon shorthand
const C = {
  outlineWarm: '#301C20',   // earth-0
  outlineCool: '#1C1C30',   // stone-0
  outlineDark: '#2C1020',   // terracotta-0
  shadow: '#181830',        // shadow-violet (44)
  crimson: '#B01C28',       // flag-crimson (46)
  brass: '#D8A428',         // brass-gold (47)
  whiteLit: '#FCECCC',      // whitewash-4
  whiteMid: '#DCD0B8',      // whitewash-3
  whiteSh: '#ACA08C',       // whitewash-2
  stoneLit: '#C8CCC0',      // stone-4
  stoneMid: '#94A0A8',      // stone-3
  stoneSh: '#606C80',       // stone-2
  earthLit: '#F0D498',      // earth-4
  earthMid: '#C8A860',      // earth-3
  earthSh: '#987438',       // earth-2
  terraLit: '#DCB47C',      // terracotta-4
  terraMid: '#B47844',      // terracotta-3
  terraSh: '#844020',       // terracotta-2
};

const BAYER4 = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER4[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;

/** A tiny frame painter: origin-relative plotting into a strip. */
class Frame {
  constructor(surface, ox, w, h) {
    this.s = surface; this.ox = ox; this.w = w; this.h = h;
  }
  px(x, y, hex) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.s.setHex(this.ox + x, y, hex);
  }
  rect(x, y, w, h, hex) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex);
  }
  /** Solid ellipse, integer coverage by centre test — no AA anywhere. */
  ellipse(cx, cy, rx, ry, hex) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, hex);
      }
    }
  }
  /** The contact shadow: dithered, solid colour, full alpha. */
  contactShadow(cx, cy, rx, ry, coverage = 0.45) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        if (bayer(x, y) >= coverage) continue;
        this.px(x, y, C.shadow);
      }
    }
  }
  /**
   * 1 px selective outline in the material's own step-0 hue.
   * Selective: only where an opaque pixel meets empty space BELOW or to the
   * SIDE — outlining the top edge too makes a 12 px animal read as a sticker.
   */
  outline(hex) {
    const opaque = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const p = this.s.get(this.ox + x, y);
        opaque.push(p && p.a > 0 ? 1 : 0);
      }
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : opaque[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1)) this.px(x, y, hex);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// the animals
// ---------------------------------------------------------------------------

/**
 * Ayam kampung — the village chicken. 12x12, 4 peck + 4 walk.
 * The comb is the whole identity at this size, so it gets the one saturated
 * colour in the sprite.
 */
function chicken(f, kind, step) {
  // peck: the head drops through 4 stages; walk: the head is level, legs move.
  const peck = kind === 'peck';
  const drop = peck ? [0, 1, 2, 1][step] : 0;
  const stride = peck ? 0 : [0, 1, 0, -1][step];

  f.contactShadow(6, 10.5, 4, 1.4);
  // body
  f.ellipse(6, 7, 3.2, 2.6, C.whiteMid);
  f.ellipse(5.2, 7.6, 2.4, 1.8, C.whiteSh);          // underside shade
  f.ellipse(6.6, 6.2, 2.0, 1.4, C.whiteLit);          // back highlight
  // tail
  f.rect(9, 4 + (peck ? 0 : Math.abs(stride)), 2, 1, C.whiteSh);
  f.px(10, 5, C.whiteMid);
  // neck + head
  const hy = 4 + drop;
  f.rect(3, hy + 1, 2, 2, C.whiteMid);
  f.ellipse(2.6, hy, 1.5, 1.3, C.whiteLit);
  // comb + wattle — the identifying accent
  f.px(2, hy - 2, C.crimson);
  f.px(3, hy - 2, C.crimson);
  f.px(2, hy + 2, C.crimson);
  // beak
  f.px(1, hy, C.brass);
  // eye
  f.px(3, hy, C.outlineWarm);
  // legs
  f.px(5 + stride, 10, C.brass);
  f.px(7 - stride, 10, C.brass);
  f.px(5 + stride, 9, C.earthSh);
  f.px(7 - stride, 9, C.earthSh);
  f.outline(C.outlineWarm);
}

/** Rock dove. 10x8, 2 idle + 4 walk + 4 fly. */
function dove(f, kind, step) {
  const fly = kind === 'fly';
  const bob = kind === 'walk' ? [0, -1, 0, 0][step] : 0;
  const stride = kind === 'walk' ? [1, 0, -1, 0][step] : 0;
  const idleTuck = kind === 'idle' ? step : 0;

  if (!fly) f.contactShadow(5, 7.2, 3, 1.1);
  const by = 3 + bob + (fly ? -1 : 0);
  // body
  f.ellipse(5, by + 1, 2.8, 2.0, C.stoneMid);
  f.ellipse(4.4, by + 1.6, 2.2, 1.4, C.stoneSh);
  f.ellipse(5.4, by + 0.4, 1.8, 1.1, C.stoneLit);
  // head
  f.ellipse(2.4, by - 0.4 - idleTuck * 0.4, 1.4, 1.3, C.stoneLit);
  f.px(1, Math.round(by - 0.4 - idleTuck * 0.4), C.terraSh);   // beak
  f.px(3, Math.round(by - 0.6 - idleTuck * 0.4), C.outlineCool); // eye
  // wings
  if (fly) {
    // 3 fly poses: up, mid, down
    const wy = [-2, 0, 2][Math.min(2, step)];
    f.rect(3, by + wy, 5, 1, C.stoneSh);
    f.rect(4, by + wy + (wy < 0 ? 1 : -1), 4, 1, C.stoneMid);
  } else {
    f.rect(4, by + 1, 3, 1, C.stoneSh);
  }
  // tail
  f.rect(7, by + 1, 3, 1, C.stoneSh);
  // legs
  if (!fly) {
    f.px(4 + stride, 6, C.terraSh);
    f.px(6 - stride, 6, C.terraSh);
  }
  f.outline(C.outlineCool);
}

/** Street cat. 14x10, 4 walk + 2 idle + 2 sit. Two recolours. */
function cat(f, kind, step, coat) {
  const lit = coat === 'grey' ? C.stoneLit : C.terraLit;
  const mid = coat === 'grey' ? C.stoneMid : C.terraMid;
  const sh = coat === 'grey' ? C.stoneSh : C.terraSh;
  const outline = coat === 'grey' ? C.outlineCool : C.outlineDark;
  const sit = kind === 'sit';
  const stride = kind === 'walk' ? [1, 0, -1, 0][step] : 0;
  const tailUp = kind === 'sit' ? step : (kind === 'idle' ? step : 0);

  f.contactShadow(7, 9.0, 5, 1.2);

  // A cat is SHORT-BODIED with a high shoulder and an arched back. The first
  // cut used a 4.2-radius body over 2 px legs and read as a weasel; the fix is
  // a compact body, taller legs, and ears that clear the skull by 2 px.
  let hx, hy;
  if (sit) {
    // haunches down, chest up: a sitting cat is a triangle
    f.ellipse(8, 6.4, 2.8, 2.8, mid);
    f.ellipse(8, 7.4, 2.4, 1.9, sh);
    f.rect(5, 3, 3, 5, mid);
    f.ellipse(5.4, 2.8, 1.9, 1.7, lit);
    hx = 5.4; hy = 2.8;
  } else {
    f.ellipse(7.4, 4.6, 3.4, 1.9, mid);   // compact barrel
    f.ellipse(7.0, 5.3, 3.0, 1.3, sh);
    f.ellipse(7.8, 3.9, 2.4, 1.1, lit);   // arched back
    f.ellipse(3.8, 3.9, 1.9, 1.7, lit);   // head, carried HIGH
    hx = 3.8; hy = 3.9;
  }
  // Ears: 2 px triangles standing clear of the skull. At 14x10 this is the
  // single cue that separates a cat from every other small quadruped, so it
  // gets solid pixels rather than a shaded suggestion.
  const ex = Math.round(hx), ey = Math.round(hy);
  f.px(ex - 2, ey - 3, mid); f.px(ex - 2, ey - 2, lit);
  f.px(ex + 1, ey - 3, mid); f.px(ex + 1, ey - 2, lit);
  f.px(ex - 1, ey - 2, lit); f.px(ex, ey - 2, lit);
  // eye
  f.px(ex - 1, ey, C.brass);
  // tail: up when sitting/idle, a low trailing curve when walking
  if (tailUp) {
    for (let k = 0; k < 5; k++) f.px(11 + (k > 3 ? 1 : 0), (sit ? 6 : 5) - k, sh);
  } else {
    for (let k = 0; k < 4; k++) f.px(11 + k, 4 - Math.floor(k / 2) + stride, sh);
  }
  // legs — 3 px, so the cat stands rather than slinks
  if (!sit) {
    f.rect(5 + stride, 6, 1, 3, sh);
    f.rect(6 + stride, 6, 1, 3, mid);
    f.rect(9 - stride, 6, 1, 3, sh);
    f.rect(10 - stride, 6, 1, 3, mid);
  } else {
    f.rect(6, 8, 4, 1, sh);
  }
  f.outline(outline);
}

/** Pariah dog. 20x14, 4 walk + 2 idle + 3 lie. Short-coat tan. */
function dog(f, kind, step) {
  const lie = kind === 'lie';
  const stride = kind === 'walk' ? [2, 0, -2, 0][step] : 0;
  const breathe = lie ? [0, 1, 0][step] : 0;

  f.contactShadow(10, lie ? 12.4 : 12.0, 7.5, 1.4);

  if (lie) {
    // lying: one long low mass, head resting on the forepaws
    f.ellipse(11, 10 - breathe * 0.3, 6.0, 2.2, C.earthMid);
    f.ellipse(10.5, 10.8, 5.4, 1.6, C.earthSh);
    f.ellipse(11.5, 9.2 - breathe * 0.3, 4.6, 1.3, C.earthLit);
    f.ellipse(4.6, 10.2, 2.4, 1.9, C.earthMid);            // head
    f.ellipse(4.6, 9.4, 2.0, 1.2, C.earthLit);
    f.rect(2, 11, 5, 1, C.earthSh);                        // muzzle on paws
    f.px(3, 8, C.earthSh); f.px(6, 8, C.earthSh);          // ears
    f.px(4, 10, C.outlineWarm);                            // eye
    for (let k = 0; k < 6; k++) f.px(16 + k, 11 - Math.floor(k / 3), C.earthSh); // tail
  } else {
    // A dog is LEGGY with a deep chest and a long muzzle. The first cut sat
    // the body at y7 on 3 px legs with a stubby face and read as a large cat —
    // so: shoulder raised, legs 5 px, and a muzzle that clearly projects.
    f.ellipse(10.5, 6.0, 5.2, 2.3, C.earthMid);
    f.ellipse(10.0, 6.9, 4.8, 1.6, C.earthSh);
    f.ellipse(11.0, 5.0, 4.0, 1.3, C.earthLit);
    f.ellipse(12.5, 5.6, 2.6, 2.0, C.earthMid);            // deep chest/haunch
    f.ellipse(5.0, 4.2, 2.3, 1.9, C.earthMid);             // head, carried high
    f.ellipse(5.0, 3.5, 1.9, 1.2, C.earthLit);
    f.rect(1, 4, 4, 2, C.earthMid);                        // long muzzle
    f.rect(1, 5, 4, 1, C.earthSh);
    f.px(3, 1, C.earthSh); f.px(7, 1, C.earthSh);          // pricked ears, tall
    f.px(3, 2, C.earthMid); f.px(7, 2, C.earthMid);
    f.px(3, 3, C.earthLit); f.px(7, 3, C.earthLit);
    f.px(5, 4, C.outlineWarm);                             // eye
    f.px(1, 4, C.outlineWarm);                             // nose
    // tail curled up over the back — the kampung/pariah dog silhouette
    for (let k = 0; k < 5; k++) f.px(16 + Math.floor(k / 3), 4 - k, C.earthSh);
    f.px(17, 0, C.earthMid);
    // legs — 5 px: the difference between a dog and a big cat is ground clearance
    f.rect(6 + stride, 8, 1, 4, C.earthSh);
    f.rect(8 + stride, 8, 1, 4, C.earthMid);
    f.rect(12 - stride, 8, 1, 4, C.earthSh);
    f.rect(14 - stride, 8, 1, 4, C.earthMid);
  }
  f.outline(C.outlineWarm);
}

// ---------------------------------------------------------------------------
// sheet assembly
// ---------------------------------------------------------------------------

/**
 * Frame order per sheet is FIXED and mirrored in src/data/fauna.json's
 * `clips`. The runtime reads clips from the data, never from frame numbers
 * hardcoded in a system.
 */
const SHEETS = [
  {
    key: 'fauna-chicken', w: 12, h: 12,
    frames: [
      ...[0, 1, 2, 3].map((i) => (f) => chicken(f, 'peck', i)),
      ...[0, 1, 2, 3].map((i) => (f) => chicken(f, 'walk', i)),
    ],
  },
  {
    key: 'fauna-dove', w: 10, h: 8,
    frames: [
      ...[0, 1].map((i) => (f) => dove(f, 'idle', i)),
      ...[0, 1, 2, 3].map((i) => (f) => dove(f, 'walk', i)),
      ...[0, 1, 2, 3].map((i) => (f) => dove(f, 'fly', i)),
    ],
  },
  {
    key: 'fauna-cat', w: 14, h: 10,
    frames: [
      ...[0, 1, 2, 3].map((i) => (f) => cat(f, 'walk', i, 'ginger')),
      ...[0, 1].map((i) => (f) => cat(f, 'idle', i, 'ginger')),
      ...[0, 1].map((i) => (f) => cat(f, 'sit', i, 'ginger')),
    ],
  },
  {
    key: 'fauna-cat-grey', w: 14, h: 10,
    frames: [
      ...[0, 1, 2, 3].map((i) => (f) => cat(f, 'walk', i, 'grey')),
      ...[0, 1].map((i) => (f) => cat(f, 'idle', i, 'grey')),
      ...[0, 1].map((i) => (f) => cat(f, 'sit', i, 'grey')),
    ],
  },
  {
    key: 'fauna-dog-pariah', w: 20, h: 14,
    frames: [
      ...[0, 1, 2, 3].map((i) => (f) => dog(f, 'walk', i)),
      ...[0, 1].map((i) => (f) => dog(f, 'idle', i)),
      ...[0, 1, 2].map((i) => (f) => dog(f, 'lie', i)),
    ],
  },
];

function buildSheet(def) {
  const surface = new Surface(def.w * def.frames.length, def.h);
  def.frames.forEach((paint, i) => paint(new Frame(surface, i * def.w, def.w, def.h)));
  return surface;
}

function run(argv) {
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;
  fs.mkdirSync(outDir, { recursive: true });

  for (const def of SHEETS) {
    const sheet = buildSheet(def);
    // Canon safety net: every pixel this tool writes comes from the C table
    // above, but quantizing is cheap and makes a future hand-edit provably
    // safe rather than probably safe.
    sheet.quantize(P);
    sheet.writePNG(path.join(outDir, `${def.key}-sheet.png`));
    console.log(`${def.key}-sheet.png  ${sheet.width}x${sheet.height}  (${def.frames.length} frames of ${def.w}x${def.h})`);
  }
  return { ok: true };
}

module.exports = { run, buildSheet, SHEETS };

if (require.main === module) run(process.argv.slice(2));
