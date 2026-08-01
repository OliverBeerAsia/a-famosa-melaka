'use strict';
/**
 * MELAKA FORGE — KIT REGISTRY
 * ===========================
 * The single prop table every kit registers into.
 *
 * WHY THIS FILE EXISTS
 * `compose-plate.cjs` dispatches layout entries by looking a type up in one
 * table (`PROPS[p.type]`). Kits therefore have to share that table, and if each
 * kit required `props.cjs` to get `def()` we would have a require cycle the
 * moment `props.cjs` pulled a helper back out of a kit. So the table and the
 * registration function live here, on their own, depended on by everything and
 * depending on nothing.
 *
 * A registration is:
 *   def(key, meta, draw)
 *     meta.collide   tile-space footprint size used for the walk mask
 *                    (0 or false = no collision; the layout entry can also say
 *                    "collide": false to opt out per-instance)
 *     meta.examine   default examine prose (layout entry overrides)
 *     meta.light     { type, radius } -> emits a night light anchor
 *     draw(surface, iso, spec)
 *
 * Draw order is the compositor's painter sort on (tx + ty); a layout entry can
 * force it with `depthAt`. Background masses use a large negative `depthAt`,
 * foreground occluders a large positive one plus `"layer": "overlay"`.
 */

const PROPS = {};

/**
 * THE CONTACT RIM IS APPLIED HERE, NOT IN EACH PROP.
 *
 * `compose-plate.cjs` decides what a prop blocks, and it does it in exactly one
 * way for all of them:
 *
 *     const c = def.collide || 0.5;
 *     if (spec.collide !== false && c > 0)
 *       blocked.push({ tx: spec.tx - c * 0.2, ty: spec.ty - c * 0.2, w: c, d: c });
 *
 * Benchmark #17 (strict) samples the boundary of precisely that rect. So the
 * darkening that marks the boundary has to be derived from precisely that rect
 * too — which means it cannot live inside the individual draw functions, where
 * every prop guesses a slightly different shadow ellipse and none of them line
 * up. Wrapping the draw here gets it right for all ~60 props at once, and it
 * stays right automatically if a prop's `collide` is ever retuned.
 *
 * Mirror any change to the compositor's blocked-rect maths in `rimFor` below.
 */
function rimFor(meta, spec) {
  const c = meta.collide === undefined ? 0.5 : meta.collide;
  if (spec.collide === false || !c || c <= 0) return null;
  if (spec.tx === undefined || spec.ty === undefined) return null;
  return { tx: spec.tx - c * 0.2, ty: spec.ty - c * 0.2, w: c, d: c };
}

function def(key, meta, draw) {
  if (PROPS[key]) throw new Error(`duplicate prop type: ${key}`);
  const entry = Object.assign({ key, rawDraw: draw }, meta);
  entry.draw = (surface, iso, spec) => {
    draw(surface, iso, spec);
    if (spec.contactRim === false) return;
    const r = rimFor(entry, spec);
    if (!r) return;
    // required late so the kits can require the registry without a cycle
    const { footprintRim } = require('./primitives.cjs');
    footprintRim(surface, iso, r.tx, r.ty, r.w, r.d, {
      strength: spec.rimStrength === undefined ? 0.72 : spec.rimStrength,
    });
  };
  PROPS[key] = entry;
  return entry;
}

module.exports = { PROPS, def };
