/**
 * The Phaser half of docs/design/typography-standard.md.
 *
 * Same two families, same legal sizes, same rules as the CSS ladder — a text
 * object drawn by the engine must be indistinguishable from one drawn by React.
 *
 * The rule everything follows from: a bitmap face has a design grid, and a size
 * that is not an integer multiple of that grid rasterises with uneven stems.
 * So there is no `fontSize: '18px'` here, and no caller passes a raw number.
 *
 * Also enforced:
 *  - `resolution: 1` and NEVER `setScale()` on a text object — scaling a
 *    rasterised glyph resamples it. Change the rung instead.
 *  - shadow offset equals the rung's glyph pixel, `blur: 0`, never two shadows.
 *  - no `fontStyle` — both faces ship one weight and no italic, so bold and
 *    italic would be synthesised (bold clogs VT323's counters; italic shears
 *    the glyphs into staircases).
 */

const DISPLAY = '"Press Start 2P", monospace';
const BODY = 'VT323, monospace';

/** Canon ink, used for every hard text shadow. */
export const INK = '#24101C';

/** Canon text colours by surface role. */
export const TEXT_COLOR = {
  /** Primary on a dark screen or over the world. */
  parch: '#F0D498',
  /** Secondary: captions, key legends, locked labels. */
  parchWarm: '#C8A860',
  /** Numerals, keys, anything brass. */
  brass: '#D8A428',
  /** Hover / active. */
  spec: '#FFF4D4',
} as const;

/**
 * The legal rungs. `glyph` is the design pixel at that size, and doubles as the
 * shadow offset — so the shadow always scales with the type.
 */
export const TYPE = {
  /** display 24 — the world tier. Location name cards. */
  displayWorld: { family: DISPLAY, size: 24, glyph: 3 },
  /** display 16 — buttons, prompts, chip labels. */
  displayLabel: { family: DISPLAY, size: 16, glyph: 2 },
  /** display 8 — micro tags only, uppercase. */
  displayTag: { family: DISPLAY, size: 8, glyph: 1 },
  /** body 30 — dialogue and prose at the world tier. */
  bodyLarge: { family: BODY, size: 30, glyph: 3 },
  /** body 20 — default prose, small floating world labels. */
  body: { family: BODY, size: 20, glyph: 2 },
} as const;

export type TypeRung = typeof TYPE[keyof typeof TYPE];

export interface TextStyleOptions {
  color?: string;
  /** Hardwood/parchment plate behind the text, for anything over the world. */
  backgroundColor?: string;
  padding?: { x: number; y: number };
  align?: string;
  /** Drop the hard shadow (only where a plate already separates the text). */
  noShadow?: boolean;
}

/**
 * Build a Phaser text style from a rung.
 *
 * Text over the world gets a plate behind it or the hard one-glyph shadow —
 * never nothing, and never a blur.
 */
export function textStyle(
  rung: TypeRung,
  options: TextStyleOptions = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: rung.family,
    fontSize: `${rung.size}px`,
    color: options.color ?? TEXT_COLOR.parch,
    resolution: 1,
  };

  if (!options.noShadow) {
    style.shadow = {
      offsetX: rung.glyph,
      offsetY: rung.glyph,
      color: INK,
      blur: 0,
      fill: true,
    };
  }
  if (options.backgroundColor) style.backgroundColor = options.backgroundColor;
  if (options.padding) style.padding = options.padding;
  if (options.align) style.align = options.align;

  return style;
}
