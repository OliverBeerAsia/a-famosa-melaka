'use strict';
/**
 * MELAKA FORGE — PLATE COMPOSITOR
 * ===============================
 * layout JSON  ->  plate PNG + walkmask PNG + derived engine data JSON
 *
 * ONE FILE DRIVES EVERYTHING. The same layout that paints the background emits
 * the collision rects, spawns, transitions, lights, prop examinables and
 * foreground-overlay sprites. This is the permanent fix for the "coordinate
 * rot" class of bug (engine-critic D1/D3/D6): a plate can no longer disagree
 * with the data authored against it, because both are the same source.
 *
 * OUTPUTS  (all native 640x360 px unless noted)
 *   <id>.png              the plate
 *   <id>@3x.png           nearest-upscaled 1920x1080 (what the engine ships)
 *   <id>-walk.png         R = walkable(255)/blocked(0), G = surface-type id
 *   <id>-fg-<n>.png       foreground occluder sprites (walk-behind)
 *   <id>.derived.json     spawns / collision / transitions / lights / props
 *
 * RENDER ORDER
 *   sky -> background silhouette -> ground (+risers) -> cast shadows
 *   -> buildings & props back-to-front by (tx+ty) -> overlays
 *
 * DETERMINISTIC: no Math.random, no Date.now. Same layout -> same bytes.
 *
 * CLI
 *   node tools/forge/compose-plate.cjs src/data/plate-layouts/rua-direita.json \
 *        --out tools/forge/staging --review
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const P = require('./palette.cjs');
const T = require('./texture.cjs');
const ISO = require('./iso.cjs');
const { Surface } = require('./surface.cjs');
const ARCH = require('./kits/arch-portuguese.cjs');
const { PROPS } = require('./kits/props.cjs');

const SURFACE_IDS = { none: 0, stone: 1, dirt: 2, wood: 3, sand: 4, water: 5, grass: 6, tile: 7 };

// ---------------------------------------------------------------------------
// ground texture factory
// ---------------------------------------------------------------------------
function groundShader(spec) {
  const o = spec || {};
  switch (o.texture) {
    case 'cobble': return T.cobble(o);
    case 'flagstone': return T.flagstone(o);
    case 'trodden': return T.trodden(o);
    case 'deck': return T.deck(o);
    case 'sand': return T.sand(o);
    case 'dirt':
    default: return T.dirt(o);
  }
}

/**
 * A poly point may be authored in raw tile space `{tx,ty}` or — far more
 * usefully — in the screen-meaningful `{s,dd}` pair the rest of the layout
 * language uses (see AUTHORING COORDINATES below). An irregular region outline
 * is the one place where a band is not enough, and hand-writing tx/ty for a
 * wandering boundary is unreadable.
 */
function polyPoints(poly) {
  return poly.map((p) => (p.tx !== undefined ? p : sdd(p.s, p.dd)));
}

function shapePolys(shape) {
  if (!shape) return [];
  if (shape.poly) return [polyPoints(shape.poly)];
  if (Array.isArray(shape)) return shape.map((s) => shapePolys(s)[0]);
  if (shape.sFrom !== undefined) return [bandPoly(shape)];
  return [ISO.rectPoly(shape.tx, shape.ty, shape.w, shape.d)];
}

// ---------------------------------------------------------------------------
// AUTHORING COORDINATES
// ---------------------------------------------------------------------------
/**
 * Raw (tx, ty) is unusable for authoring a STREET, because a street runs along
 * the (1,-1) tile direction and every point on it has different tx and ty. So
 * layouts are authored in the two coordinates that actually mean something on
 * screen:
 *
 *   s  = tx + ty   -> screen DEPTH.      screenY = originY + s * tileHeight/2
 *   dd = tx - ty   -> screen HORIZONTAL. screenX = originX + dd * tileWidth/2
 *
 * A street is then "s from 25 to 39, dd from -26 to 27" — a readable band —
 * and a terrace of shophouses is a chain of buildings sharing one frontS.
 *   tx = (s + dd) / 2      ty = (s - dd) / 2
 */
function sdd(s, dd) { return { tx: (s + dd) / 2, ty: (s - dd) / 2 }; }

/** {sFrom,sTo,ddFrom,ddTo} -> tile-space polygon. */
function bandPoly(b) {
  return [
    sdd(b.sFrom, b.ddFrom), sdd(b.sFrom, b.ddTo),
    sdd(b.sTo, b.ddTo), sdd(b.sTo, b.ddFrom),
  ];
}

/** Give any entry tx/ty from whichever coordinate form it was authored in. */
function resolveEntry(iso, e, kind) {
  if (e.tx !== undefined && e.ty !== undefined) return e;
  const out = Object.assign({}, e);
  if (kind === 'building' && e.frontS !== undefined) {
    const c = sdd(e.frontS, e.dd);
    out.tx = c.tx - (e.w || 1);
    out.ty = c.ty - (e.d || 1);
    return out;
  }
  if (e.s !== undefined && e.dd !== undefined) return Object.assign(out, sdd(e.s, e.dd));
  if (e.x !== undefined && e.y !== undefined) {
    const t = iso.toTile(e.x, e.y, e.z || 0);
    return Object.assign(out, t);
  }
  return out;
}

function normalizeLayout(layout, iso) {
  const L = JSON.parse(JSON.stringify(layout));
  (L.buildings || []).forEach((b, i) => { L.buildings[i] = resolveEntry(iso, b, 'building'); });
  (L.props || []).forEach((p, i) => { L.props[i] = resolveEntry(iso, p, 'prop'); });
  (L.lights || []).forEach((p, i) => { L.lights[i] = resolveEntry(iso, p, 'light'); });
  (L.animatedProps || []).forEach((p, i) => { L.animatedProps[i] = resolveEntry(iso, p, 'anim'); });
  ['spawns', 'npcs'].forEach((k) => {
    if (!L[k]) return;
    Object.keys(L[k]).forEach((n) => { L[k][n] = resolveEntry(iso, L[k][n], 'point'); });
  });
  (L.transitions || []).forEach((t, i) => { L.transitions[i] = resolveEntry(iso, t, 'point'); });
  return L;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function compose(rawLayout, opts) {
  const o = opts || {};
  const W = rawLayout.canvas.width, H = rawLayout.canvas.height;
  const iso = ISO.createIso(rawLayout.iso);
  const layout = normalizeLayout(rawLayout, iso);
  const plate = new Surface(W, H);
  const overlay = new Surface(W, H);
  const derived = {
    blocked: [], doors: [], lights: [], examinables: [], overlays: [],
  };

  // ---- 0. sky ------------------------------------------------------------
  const hz = layout.horizon || {};
  plate.clear(P.RAMPS.sky[1]);
  if (hz.skyTo) {
    const sky = T.skyGradient({ y0: 0, y1: hz.skyTo, topStep: hz.skyTop === undefined ? 3 : hz.skyTop, botStep: hz.skyBottom === undefined ? 1 : hz.skyBottom });
    plate.fillRect(0, 0, W, hz.skyTo + 1, (u, v, x, y) => sky(u, v, x, y));
  }

  // ---- 1. background silhouette plane ------------------------------------
  (layout.background || []).forEach((b) => {
    if (b.type === 'distant-roofline') {
      ARCH.distantRoofline(plate, iso, b, derived);
    } else if (b.type === 'hill') {
      drawHill(plate, b);
    } else if (b.type === 'tower') {
      drawTower(plate, b);
    } else if (b.type === 'bastion') {
      drawBastion(plate, b);
    }
  });

  // ---- 2. ground ---------------------------------------------------------
  // Regions are tested top-most first so later entries win, and the walk mask
  // falls out of the same pass — plate and collision can never disagree.
  const regions = (layout.ground || []).map((g, i) => ({
    i, g,
    polys: shapePolys(g.shape),
    shader: groundShader(Object.assign({ seed: 100 + i }, g)),
    z: g.z || 0,
    surfaceId: SURFACE_IDS[g.surface || 'dirt'] || 0,
    walkable: g.walkable !== false,
  }));
  const backdrop = layout.backdrop
    ? { shader: groundShader(Object.assign({ seed: 7 }, layout.backdrop)), surfaceId: SURFACE_IDS[layout.backdrop.surface || 'dirt'] || 0 }
    : null;

  const walk = new Surface(W, H);
  const groundTop = hz.groundFrom === undefined ? 0 : hz.groundFrom;
  for (let y = groundTop; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hit = null;
      for (let k = regions.length - 1; k >= 0; k--) {
        const r = regions[k];
        const t = iso.toTile(x + 0.5, y + 0.5, r.z);
        let inside = false;
        for (const poly of r.polys) { if (ISO.tileInPoly(t.tx, t.ty, poly)) { inside = true; break; } }
        if (inside) { hit = { r, t }; break; }
      }
      if (!hit && backdrop) {
        const t = iso.toTile(x + 0.5, y + 0.5, 0);
        const c = backdrop.shader(t.tx, t.ty, x, y);
        if (c) plate.setHex(x, y, c);
        walk.setRGBA(x, y, 0, backdrop.surfaceId, 0, 255);
        continue;
      }
      if (!hit) continue;
      const c = hit.r.shader(hit.t.tx, hit.t.ty, x, y);
      if (c) plate.setHex(x, y, c);
      walk.setRGBA(x, y, hit.r.walkable ? 255 : 0, hit.r.surfaceId, 0, 255);
    }
  }

  // risers for raised ground (arcade plinths, quay edges)
  regions.filter((r) => r.z > 0).forEach((r) => {
    const g = r.g;
    if (!g.shape || !g.shape.w) return;
    const fLit = iso.face({ tx: g.shape.tx, ty: g.shape.ty + g.shape.d }, { tx: g.shape.tx + g.shape.w, ty: g.shape.ty + g.shape.d }, r.z, 0);
    ISO.drawFace(plate, fLit, T.ashlar({ material: 'stone', light: 3, blockW: 10, blockH: 4, seed: 200 + r.i }));
    const fSh = iso.face({ tx: g.shape.tx + g.shape.w, ty: g.shape.ty + g.shape.d }, { tx: g.shape.tx + g.shape.w, ty: g.shape.ty }, r.z, 0);
    ISO.drawFace(plate, fSh, T.ashlar({ material: 'stone', light: 1, blockW: 10, blockH: 4, seed: 201 + r.i }));
    const x0 = Math.round(fLit.p0.x);
    for (let u = 0; u < fLit.lenPx; u++) T.aoBand(plate, x0 + u, fLit.baseYAt(u + 0.5) + 2, 2, 0.34);
  });

  // ---- 2b. shade bands on the ground -------------------------------------
  // Baked ambient shade for spaces that are ROOFED but not walled: under an
  // arcade, inside a covered market, in the lee of a terrace. Without it the
  // pavement behind a colonnade renders at the same value as the piers and the
  // arches read as a low wall rather than as openings.
  (layout.shade || []).forEach((sh) => {
    const polys = shapePolys(sh.shape);
    const strength = sh.strength === undefined ? 0.30 : sh.strength;
    polys.forEach((poly) => {
      const pts = poly.map((p) => iso.toScreen(p.tx, p.ty, 0));
      plate.fillPoly(pts, (u, v, x, y) => {
        T.shadePixel(plate, x, y, T.checker2(x, y) ? strength : strength * 0.55);
        return null;
      });
    });
  });

  // ---- 3. renderables, sorted back-to-front ------------------------------
  const items = [];

  (layout.buildings || []).forEach((b, i) => {
    const kit = b.kit || 'townhouse';
    const depth = b.depthAt !== undefined ? b.depthAt : (b.tx + (b.w || 1)) + (b.ty + (b.d || 1));
    items.push({
      depth, layer: b.layer || 'plate', label: `${kit}#${i}`,
      draw: (surf, out) => {
        const spec = Object.assign({ seed: 300 + i * 7 }, b);
        if (kit === 'townhouse') ARCH.townhouse(surf, iso, spec, out);
        else if (kit === 'arcade') ARCH.arcade(surf, iso, spec, out);
        else if (kit === 'well') ARCH.well(surf, iso, spec, out);
        else if (kit === 'pelourinho') ARCH.pelourinho(surf, iso, spec, out);
        else if (kit === 'stair') ARCH.stair(surf, iso, spec, out);
        else throw new Error('unknown kit: ' + kit);
      },
    });
  });

  (layout.props || []).forEach((p, i) => {
    const def = PROPS[p.type];
    if (!def) throw new Error('unknown prop type: ' + p.type);
    const c = def.collide || 0.5;
    const depth = p.depthAt !== undefined ? p.depthAt : (p.tx + c) + (p.ty + c);
    items.push({
      depth, layer: p.layer || 'plate', label: `${p.type}#${i}`,
      draw: (surf, out) => {
        const spec = Object.assign({ seed: 500 + i * 13 }, p);
        // BOUNDARY DRESSING. A ground region's edge is a hard point-in-polygon
        // cut by design (no feathering — that is what would turn pixel art into
        // a scaled photograph). The way a hard edge is made to READ as a real
        // boundary is by DRESSING it: a kerb, loose stones, a scrub line. So a
        // prop can name a ground region and receive its outline, and the
        // dressing can never drift off the seam it exists to hide, because it
        // is derived from the same polygon that cut it.
        if (p.edgeOf) {
          const g = (layout.ground || []).find((gg) => gg.id === p.edgeOf);
          if (!g) throw new Error(`edgeOf: no ground region "${p.edgeOf}"`);
          spec.poly = shapePolys(g.shape)[0];
        }
        def.draw(surf, iso, spec);
        if (p.collide !== false && c > 0) {
          out.blocked.push({ tx: p.tx - c * 0.2, ty: p.ty - c * 0.2, w: c, d: c });
        }
        const anchor = iso.toScreen(p.tx + c * 0.3, p.ty + c * 0.3, 0);
        if (p.examine !== false) {
          out.examinables.push({
            key: p.key || `${p.type}-${i}`, type: p.type,
            x: Math.round(anchor.x), y: Math.round(anchor.y),
            label: p.label || p.type.replace(/-/g, ' '),
            examineText: p.examineText || def.examine,
            interactive: !!p.interactive,
          });
        }
        if (def.light) {
          out.lights.push({
            x: Math.round(anchor.x), y: Math.round(anchor.y) - (p.h || 30),
            type: def.light.type, radius: def.light.radius, nightOnly: true,
          });
        }
      },
    });
  });

  items.sort((a, b) => (a.depth - b.depth) || (a.label < b.label ? -1 : 1));

  // A foreground occluder is drawn TWICE: once alone, to learn its silhouette,
  // and once into the plate so flip-screen mode stays visually complete.
  // The solo pass is a MASK ONLY — see the cut below.
  const overlayEntries = [];
  items.forEach((it) => {
    if (it.layer === 'overlay') {
      const solo = new Surface(W, H);
      it.draw(solo, derived);
      const bounds = solo.opaqueBounds();
      if (bounds) {
        overlayEntries.push({ label: it.label, solo, bounds, depth: it.depth });
        overlay.composite(solo, 0, 0);
      }
      plate.composite(solo, 0, 0);
    } else {
      it.draw(plate, derived);
    }
  });

  // ---- 4. blocked footprints -> walk mask --------------------------------
  derived.blocked.forEach((b) => {
    if (b.screen) {
      for (let y = Math.floor(b.screen.y); y < b.screen.y + b.screen.h; y++) {
        for (let x = Math.floor(b.screen.x); x < b.screen.x + b.screen.w; x++) walk.setRGBA(x, y, 0, walkSurfaceAt(walk, x, y), 0, 255);
      }
      return;
    }
    const poly = ISO.rectPoly(b.tx, b.ty, b.w, b.d);
    const pts = poly.map((p) => iso.toScreen(p.tx, p.ty, 0));
    walk.fillPoly(pts, (u, v, x, y) => { walk.setRGBA(x, y, 0, walkSurfaceAt(walk, x, y), 0, 255); return null; });
  });
  (layout.blocked || []).forEach((b) => {
    const pts = shapePolys(b).flat().length ? shapePolys(b)[0].map((p) => iso.toScreen(p.tx, p.ty, 0)) : null;
    if (pts) walk.fillPoly(pts, (u, v, x, y) => { walk.setRGBA(x, y, 0, walkSurfaceAt(walk, x, y), 0, 255); return null; });
  });

  // ---- 5. quantize to canon, then INDEX THE SCREEN ----------------------
  // Benchmark #14: the canon is 50 colours but any one screen may use <= 40.
  // Keeping the 40 most-used and folding the tail into their nearest neighbour
  // is the classic per-screen palette-index step; it also kills the handful of
  // stray colours a lone prop drags in (Fallout/BG both did exactly this).
  plate.quantize(P);
  const used = indexScreen(plate, o.screenBudget || 40);

  // ---- 5b. CUT THE FOREGROUND SPRITES OUT OF THE FINISHED PLATE ----------
  // The solo pass above gives a correct SILHOUETTE but wrong PIXELS: anything
  // drawn later — a prop in front, the per-screen palette fold, a cast shadow
  // landing on the occluder — exists on the plate and not in the solo surface.
  // Cutting from the solo surface therefore shipped an overlay sprite that
  // disagreed with the plate underneath it (1.65% of pixels on rua-direita),
  // and the seam showed as the player walked behind it. So the sprite is
  // stamped from the FINAL plate, using the solo surface purely as an alpha
  // stencil. By construction the two now agree pixel for pixel.
  overlayEntries.forEach((oe) => {
    const cut = new Surface(W, H);
    const sd = oe.solo.data, cd = cut.data, pd = plate.data;
    for (let i = 0; i < sd.length; i += 4) {
      if (sd[i + 3] === 0) continue;
      cd[i] = pd[i]; cd[i + 1] = pd[i + 1]; cd[i + 2] = pd[i + 2]; cd[i + 3] = 255;
    }
    oe.cut = cut;
  });

  // ---- 6. derived engine data -------------------------------------------
  const collisionRects = deriveCollisionRects(walk, o.collisionCell || 8);
  const lights = derived.lights.concat((layout.lights || []).map((l) => {
    const p = l.tx !== undefined ? iso.toScreen(l.tx, l.ty, l.z || 0) : { x: l.x, y: l.y };
    return { x: Math.round(p.x), y: Math.round(p.y), type: l.type, radius: l.radius || 40, nightOnly: l.nightOnly !== false };
  }));

  const toPx = (pt) => (pt.tx !== undefined ? roundPt(iso.toScreen(pt.tx, pt.ty, pt.z || 0)) : { x: pt.x, y: pt.y });

  const engine = {
    id: layout.id,
    name: layout.name,
    generatedBy: 'tools/forge/compose-plate.cjs',
    layoutHash: hashLayout(layout),
    world: { scale: 3, nativeWidth: W, nativeHeight: H },
    sun: { azimuthDeg: P.SUN.azimuthDeg, elevationDeg: P.SUN.elevationDeg, litFace: '+ty', shadowFace: '+tx', castOffset: [1, 0.5] },
    iso: layout.iso,
    plate: { background: `scene-${layout.id}`, runtimeMode: 'legacy-backdrop', walkMask: `${layout.id}-walk` },
    collision: { rects: collisionRects },
    spawns: layout.spawns ? mapValues(layout.spawns, toPx) : {},
    npcs: layout.npcs ? mapValues(layout.npcs, toPx) : {},
    transitions: (layout.transitions || []).map((t) => ({
      targetLocation: t.targetLocation, label: t.label,
      triggerArea: t.triggerArea, spawnAt: t.spawnAt,
      anchor: t.tx !== undefined ? toPx(t) : undefined,
    })),
    props: derived.examinables,
    doors: derived.doors,
    lights,
    animatedProps: (layout.animatedProps || []).map((a) => Object.assign({}, a, toPx(a))),
    crowd: layout.crowd || undefined,
    overlays: [],
    palette: { canonUsed: used.size, budget: 40 },
  };

  return { plate, walk, overlay, overlayEntries, engine, iso, derived, used };
}

/** Fold a quantized surface down to its `budget` most-used canon colours. */
function indexScreen(surface, budget) {
  const d = surface.data;
  const counts = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  if (counts.size <= budget) return new Set(counts.keys());
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const keep = ranked.slice(0, budget).map(([k]) => ({
    k, r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255,
  }));
  const remap = new Map();
  ranked.slice(budget).forEach(([k]) => {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    let best = keep[0], bd = Infinity;
    for (const c of keep) {
      const dr = c.r - r, dg = c.g - g, db = c.b - b;
      const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (dist < bd) { bd = dist; best = c; }
    }
    remap.set(k, best);
  });
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const to = remap.get(k);
    if (to) { d[i] = to.r; d[i + 1] = to.g; d[i + 2] = to.b; }
  }
  return new Set(keep.map((c) => c.k));
}

function walkSurfaceAt(walk, x, y) {
  const p = walk.get(x, y);
  return p ? p.g : 0;
}

function roundPt(p) { return { x: Math.round(p.x), y: Math.round(p.y) }; }
function mapValues(obj, fn) {
  const out = {};
  Object.keys(obj).forEach((k) => { out[k] = fn(obj[k]); });
  return out;
}

function drawHill(surface, spec) {
  const haze = spec.haze === undefined ? 0.5 : spec.haze;
  const a = T.hazed(P.RAMPS.foliage[2], haze);
  const b = T.hazed(P.RAMPS.foliage[1], haze);
  const cx = spec.cx, base = spec.baseY, rx = spec.rx, ry = spec.ry;
  for (let x = Math.max(0, cx - rx); x < Math.min(surface.width, cx + rx); x++) {
    const t = (x - cx) / rx;
    const top = Math.round(base - ry * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let y = top; y < base; y++) {
      surface.setHex(x, y, t < -0.1 ? a : b);
      if (y === top) surface.setHex(x, y, T.hazed(P.RAMPS.foliage[3], haze));
    }
  }
}

/**
 * A Famosa, seen from across the water: a battlemented laterite block with a
 * gate arch. A BACKGROUND SILHOUETTE, not a kit piece.
 *
 * The fortress kit (`fortress-wall`) draws the real thing — coursed ashlar,
 * pilasters, a rampart walk with thickness — and at 20px tall on a 320px frame
 * all of that resolves to a brown crate. A distant mass needs three features
 * and no more: a flat top, merlons, and one dark opening. Same reason
 * `drawTower` exists rather than placing the church kit on the horizon.
 */
function drawBastion(surface, spec) {
  const haze = spec.haze === undefined ? 0.4 : spec.haze;
  const x0 = spec.x, w = spec.w, base = spec.baseY, h = spec.h;
  const lit = T.hazed(P.RAMPS.terracotta[3], haze);
  const body = T.hazed(P.RAMPS.terracotta[2], haze);
  const dark = T.hazed(P.RAMPS.terracotta[1], haze);
  const cap = T.hazed(P.RAMPS.earth[3], haze);
  const hole = T.hazed(P.ANCHORS['shadow-violet'], haze * 0.5);
  for (let x = x0; x < x0 + w; x++) {
    const t = (x - x0) / w;
    for (let y = base - h; y < base; y++) {
      // one string course, and the lit face is the left third (NW key)
      const course = ((base - y) % 7) === 0;
      surface.setHex(x, y, course ? dark : t < 0.34 ? lit : t < 0.72 ? body : dark);
    }
  }
  // merlons: alternating blocks standing above the wall head
  const merlon = spec.merlon || 3;
  for (let x = x0; x < x0 + w; x++) {
    if (Math.floor((x - x0) / merlon) % 2) continue;
    for (let k = 1; k <= 2; k++) surface.setHex(x, base - h - k, ((x - x0) % merlon) === 0 ? lit : body);
    surface.setHex(x, base - h - 3, cap);
  }
  // the gate: a dark arched opening, always on the frame-facing third
  const gw = Math.max(3, Math.round(w * 0.22));
  const gx = x0 + Math.round(w * (spec.gateAt === undefined ? 0.5 : spec.gateAt)) - (gw >> 1);
  const gh = Math.max(4, Math.round(h * 0.52));
  for (let x = gx; x < gx + gw; x++) {
    const dxc = (x + 0.5) - (gx + gw / 2);
    const arch = Math.round(Math.sqrt(Math.max(0, (gw / 2) * (gw / 2) - dxc * dxc)));
    for (let y = base - gh - arch; y < base; y++) surface.setHex(x, y, hole);
  }
  // a flagstaff on the seaward shoulder
  if (spec.flag !== false) {
    const fx = x0 + Math.round(w * 0.14);
    for (let k = 0; k < Math.max(3, Math.round(h * 0.34)); k++) surface.setHex(fx, base - h - 3 - k, cap);
  }
}

function drawTower(surface, spec) {
  const haze = spec.haze === undefined ? 0.34 : spec.haze;
  const wall = T.hazed(P.RAMPS.whitewash[3], haze);
  const wallS = T.hazed(P.RAMPS.whitewash[1], haze);
  const roofc = T.hazed(P.RAMPS.terracotta[2], haze);
  const x0 = spec.x, w = spec.w, base = spec.baseY, h = spec.h;
  for (let x = x0; x < x0 + w; x++) {
    for (let y = base - h; y < base; y++) {
      surface.setHex(x, y, (x - x0) < w * 0.55 ? wall : wallS);
    }
  }
  // belfry openings
  for (let i = 0; i < 2; i++) {
    for (let x = x0 + 3 + i * (w - 8); x < x0 + 3 + i * (w - 8) + 4; x++) {
      for (let y = base - h + 8; y < base - h + 18; y++) surface.setHex(x, y, T.hazed(P.ANCHORS['shadow-violet'], haze * 0.6));
    }
  }
  // pyramidal cap
  const cap = spec.cap || 12;
  for (let k = 0; k < cap; k++) {
    const inset = Math.round(k * (w / 2 / cap));
    for (let x = x0 + inset; x < x0 + w - inset; x++) surface.setHex(x, base - h - k, roofc);
  }
  // cross finial
  const cx = Math.round(x0 + w / 2);
  for (let k = 0; k < 6; k++) surface.setHex(cx, base - h - cap - k, wall);
  for (let k = -2; k <= 2; k++) surface.setHex(cx + k, base - h - cap - 4, wall);
}

// ---------------------------------------------------------------------------
// walk mask -> collision rects (greedy maximal-rectangle cover on a 4px grid)
// ---------------------------------------------------------------------------
function deriveCollisionRects(walk, cell) {
  const cw = Math.ceil(walk.width / cell), ch = Math.ceil(walk.height / cell);
  const blocked = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let block = 0, total = 0;
      for (let y = cy * cell; y < Math.min(walk.height, (cy + 1) * cell); y++) {
        for (let x = cx * cell; x < Math.min(walk.width, (cx + 1) * cell); x++) {
          total++;
          if (walk.get(x, y).r < 128) block++;
        }
      }
      blocked[cy * cw + cx] = (block * 2 > total) ? 1 : 0;
    }
  }
  const done = new Uint8Array(cw * ch);
  const rects = [];
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      if (!blocked[cy * cw + cx] || done[cy * cw + cx]) continue;
      let w = 0;
      while (cx + w < cw && blocked[cy * cw + cx + w] && !done[cy * cw + cx + w]) w++;
      let h = 1;
      outer: while (cy + h < ch) {
        for (let k = 0; k < w; k++) {
          const idx = (cy + h) * cw + cx + k;
          if (!blocked[idx] || done[idx]) break outer;
        }
        h++;
      }
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) done[(cy + j) * cw + cx + k] = 1;
      rects.push({ x: cx * cell, y: cy * cell, width: w * cell, height: h * cell });
    }
  }
  return rects;
}

function hashLayout(layout) {
  return crypto.createHash('sha1').update(JSON.stringify(layout)).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function run(argv) {
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { console.error('usage: compose-plate.cjs <layout.json> [--out DIR] [--review] [--scale 3]'); process.exit(1); }
  const outDir = argFlag(argv, '--out') || path.resolve(__dirname, 'staging');
  const layout = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const t0 = Date.now();
  const res = compose(layout, {});
  fs.mkdirSync(outDir, { recursive: true });

  const id = layout.id;
  res.plate.writePNG(path.join(outDir, `${id}.png`));
  // SCREEN MODE. A title/loading panorama is composed from the same kits as a
  // world plate and must be, or it would not belong to the same game — but it
  // is not somewhere you can stand. There is nothing to walk on, nothing to
  // collide with, nothing to spawn at, and emitting a walk mask and a derived
  // engine document for it would put a fictional location into the tree for
  // validate-location-data.cjs to find. So screen mode writes the picture and
  // stops.
  const screen = argv.includes('--screen');
  if (!screen) res.walk.writePNG(path.join(outDir, `${id}-walk.png`));
  if (screen || argv.includes('--scale') || argv.includes('--3x')) {
    res.plate.scaleNearest(3).writePNG(path.join(outDir, `${id}@3x.png`));
  }
  if (screen) {
    console.log(`screen     ${id}.png            ${res.plate.width}x${res.plate.height} (+ @3x)`);
    console.log(`palette    ${res.used.size} canon colours used (budget 40)`);
    console.log(`took       ${Date.now() - t0}ms   layoutHash ${res.engine.layoutHash}`);
    return res;
  }

  res.overlayEntries.forEach((oe, i) => {
    // `cut` is stamped from the finished plate (compose step 5b); it is already
    // canon-quantized and palette-folded, so re-quantizing is a no-op kept only
    // for the case where an older caller passes a solo-only entry.
    const cropped = (oe.cut || oe.solo).crop(oe.bounds.x, oe.bounds.y, oe.bounds.width, oe.bounds.height);
    cropped.quantize(P);
    const key = `${id}-fg-${i}`;
    cropped.writePNG(path.join(outDir, `${key}.png`));
    res.engine.overlays.push({
      key, sprite: `${key}.png`,
      x: oe.bounds.x, y: oe.bounds.y,
      width: oe.bounds.width, height: oe.bounds.height,
      depthY: oe.bounds.y + oe.bounds.height,
      from: oe.label,
    });
  });

  fs.writeFileSync(path.join(outDir, `${id}.derived.json`), JSON.stringify(res.engine, null, 2));

  console.log(`plate      ${id}.png            ${res.plate.width}x${res.plate.height}`);
  console.log(`walkmask   ${id}-walk.png       ${res.engine.collision.rects.length} collision rects`);
  console.log(`overlays   ${res.engine.overlays.length}`);
  console.log(`props      ${res.engine.props.length} examinables · lights ${res.engine.lights.length}`);
  console.log(`palette    ${res.used.size} canon colours used (budget 40)`);
  console.log(`took       ${Date.now() - t0}ms   layoutHash ${res.engine.layoutHash}`);

  if (argv.includes('--review')) {
    const { review } = require('./render-review.cjs');
    review(layout, res, { outDir: argFlag(argv, '--review-out') || path.resolve(__dirname, '../../docs/art-bible/forge/review') });
  }
  return res;
}

function argFlag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

module.exports = { compose, deriveCollisionRects, SURFACE_IDS, groundShader, run, sdd, bandPoly, normalizeLayout };

if (require.main === module) run(process.argv.slice(2));
