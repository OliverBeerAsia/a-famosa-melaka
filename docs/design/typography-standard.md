# Melaka Typography Standard

The chrome rule is **author at native, ship at an integer multiple**. Type obeys
the same rule.

A bitmap face has a design grid. A `font-size` that is not an integer multiple
of that grid rasterises with uneven stems — some 1px, some 2px — which is the
type equivalent of a half-pixel sprite. Everything below follows from that one
fact, and every number was measured in Chrome at `deviceScaleFactor: 1`, not
guessed.

Implemented in `src/styles/index.css` (`TYPOGRAPHY STANDARD` block + the
`.type-*` ladder at the foot of the file). Phaser-side text must follow the same
table; see **Applying this to Phaser** at the end.

---

## 1. Two families. There is no third.

| Role | Family | Design grid | Advance | x-height |
|---|---|---|---|---|
| **display** | Press Start 2P | 8px | `1.00em` | `0.75em` |
| **body** | VT323 | 10px | `0.40em` | `0.40em` |

Both are already loaded in `index.html`. Both are monospace, single-weight, and
have no italic.

Cinzel and Crimson Text are **gone from every in-game surface**. They were never
actually rendering anyway: `tailwind.config.js` maps `font-cinzel` → Press Start
2P and `font-crimson` → VT323, so those class names were lying about what they
drew. Do not reintroduce them; use the `.type-*` classes.

> **The title screen gets no display exception.** It was the obvious candidate
> for one, but there is nothing to except it *from* — the display face is
> already a pixel face, so the title is simply the top rung of the display
> ladder (`.type-title`, 40px = 5× the grid). The old title was `text-4xl`
> (36px), which is not a multiple of 8 and rendered with uneven stems.

## 2. Legal sizes

```
display   8   16   24   32   40      (multiples of 8)
body          20   30   40           (multiples of 10)
```

Nothing else. **If a string does not fit at a legal size, the container
changes — never the size.** (The pause menu became two columns for exactly this
reason; the title menu buttons went 264px → 312px.)

**×3 is the world tier.** `display 24` and `body 30` are exactly three design
pixels per glyph pixel — the same density as the plates, the sprites and the
chrome. Those are the defaults. `16/20` is the denser secondary tier. `display
8` is for micro tags only.

### Why those and not others

| | measured | verdict |
|---|---|---|
| Press Start 2P @ 12px | advance 12px (integer) but grid step 1.5px | **illegal** — `H` alternates 1px and 2px stems |
| Press Start 2P @ 16px | grid step 2.0px | legal |
| VT323 @ 10px | x-height 4px | **illegal** — below the floor, stems drop out entirely |
| VT323 @ 15px | advance 6px (integer) but grid step 1.5px | **illegal** |
| VT323 @ 20px | grid step 2.0px, x-height 8px | legal |

An integer *advance* is necessary but not sufficient — 15px VT323 has one and
still renders unevenly, because the advance and the stem are different
constraints. Only an integer *grid step* guarantees both.

### Minimum size

**Nothing below a 5px on-screen x-height.** `display 8` → 6px. `body 20` → 8px.
Both clear it, and they are the smallest legal sizes, so the rule is
self-enforcing. The bug that started this pass was a HUD clock at
`text-[10px]` — a 4px x-height, and clipped.

## 3. Anti-aliasing is off, globally

```css
body { -webkit-font-smoothing: none; }
```

**This line is load-bearing.** With it, both faces render 0.0% grey pixels at
every size tested. Without it, VT323 at 20px is 76% grey pixels — a bitmap face
rendered with AA is the same crime as a soft edge on a sprite.

## 4. Letter-spacing in integer px, never `em`

`0.18em` at 24px is 4.32px. Fractional tracking lands glyph origins on
fractional pixels and produces visibly uneven gaps between letters. Use `0`,
`1px` or `2px`.

## 5. No synthetic emphasis, ever

Both faces ship one weight and no italic, so the browser *fakes* them:

- `font-weight: 700` thickens stems unevenly and **clogs VT323's counters** —
  the holes in `n`, `m`, `e` fill in.
- `font-style: italic` shears the glyphs into ragged staircases.

```css
body { font-synthesis: none; }
```

enforces this at the engine level, so a stray `font-bold` degrades to normal
instead of smearing. **Emphasise with colour, case, or spacing.**

## 6. One backing rule for text over the world

Text never floats raw over gameplay. It sits on a **hardwood chip**
(`.ui-chip`) or a **parchment panel**. That is the pattern; the HUD readouts are
the reference implementation.

Where a backing is genuinely impossible — a floating world-space label — use
`.type-on-world`, which is exactly one hard offset shadow of **one glyph-pixel**
in `--ink`:

```css
.type-on-world { text-shadow: var(--glyph) var(--glyph) 0 var(--ink); }
```

`--glyph` is set by each ladder class (5px at `.type-title` … 1px at
`.type-tag`), so the shadow always scales with the type. **Never blurred**, and
never a second shadow.

## 7. The ladder

| Class | Family | Size | Line | `--glyph` | Use |
|---|---|---|---|---|---|
| `.type-title` | display | 40 | 48 | 5px | game title only |
| `.type-h1` | display | 24 | 32 | 3px | panel + screen headings |
| `.type-h2` | display | 16 | 24 | 2px | buttons, speaker name, topic numbers, chip labels |
| `.type-tag` | display | 8 | 12 | 1px | micro tags (QUEST, CRUZADOS, timestamps) — uppercase, 1px tracking |
| `.type-numeral` | display | 16 | 24 | 2px | clocks, money — `tabular-nums` so digits do not reflow |
| `.type-body` | body | 20 | 30 | 2px | default prose, key legends, topic rows |
| `.type-body-lg` | body | 30 | 42 | 3px | dialogue text |
| `.type-caption` | body | 20 | 24 | 2px | small uppercase labels — 2px tracking |
| `.type-caption-tight` | — | — | — | — | modifier: drops caption tracking where a row is tight |

**Captions use the body face, not `display 8`.** At the same footprint VT323
carries an 8px x-height where Press Start 2P carries 6px — a strictly better
trade for anything longer than a few characters.

> **Source order is the override mechanism.** The `.type-*` classes are declared
> at the *bottom* of `index.css`. They share a layer and a specificity with the
> `.ui-*` classes, so the one declared last wins — a `.type-h2` written beside a
> `.ui-heading` has to be able to beat the heading's default size. Moving that
> block is not cosmetic; it will silently change sizes across the game.

## 8. Colour per surface

Contrast differs per surface, so colour is not interchangeable between them.

**On parchment** (`#F0D498`):

| Role | Var | Hex |
|---|---|---|
| heading | `--wax-deep` | `#581814` |
| body | `--wood` | `#44201C` |
| secondary / caption | `--wood-lit` | `#704828` |
| section mark, fleuron | `.ui-accent` | `#844020` |
| objective complete | `.ui-done` | `#387024` |

**Gold on parchment is banned** — `#D4AF37` on `#F0D498` is invisible.
Terracotta is the accent on paper.

**On hardwood** (chips, buttons, topic rows):

| Role | Var | Hex |
|---|---|---|
| primary | `--parch` | `#F0D498` |
| secondary | `--parch-warm` | `#C8A860` |
| numerals, keys, brass | `--brass` | `#D8A428` |
| hover / active | `--spec` | `#FFF4D4` |
| disabled | `--wood-hi` | `#9C7C4C` |

**On a dark screen** (title, credits, loading): `--parch` for body,
`--parch-warm` for captions and key legends.

The HUD clock carries **time of day as its colour**, not as a second word — the
old chip read "Day 1 · day", which stutters. `dawn #F5C860` · `day #D8A428` ·
`dusk #B47844` · `night #6098C8`, all canon.

## 9. Do / don't

```jsx
/* DO */
<span className="type-numeral" style={{ color: 'var(--brass)' }}>{time}</span>
<p className="ui-body type-body">{description}</p>
<h2 className="ui-heading">{title}</h2>            {/* .ui-heading is type-h1 */}
<span className="type-tag">Quest</span>

/* DON'T */
<span className="font-mono text-lg">{time}</span>   /* system face, not a pixel face */
<p className="text-sm">…</p>                        /* 14px is off-grid for both families */
<p className="text-[10px]">…</p>                    /* 4px x-height, below the floor */
<em className="italic">…</em>                       /* synthetic oblique */
<b className="font-bold">…</b>                      /* synthetic bold */
<p className="tracking-[0.18em]">…</p>              /* fractional tracking */
<p className="type-body" style={{fontSize: 22}}>    /* not a multiple of 10 */
```

`font-mono` is the trap that caused the original bug report: it resolves to
Tailwind's **system** monospace stack (SF Mono / Menlo on macOS), which is not a
pixel font at all. There is no legitimate use of `font-mono`, `font-cinzel` or
`font-crimson` in this project.

## Applying this to Phaser

Phaser text objects take the same table. For `this.add.text(...)`:

```js
// display, ×3 world tier — location name card, interaction prompt
{ fontFamily: '"Press Start 2P", monospace', fontSize: '24px', color: '#F0D498',
  shadow: { offsetX: 3, offsetY: 3, color: '#24101C', blur: 0, fill: true } }

// body, ×3 world tier — loading screen prose
{ fontFamily: 'VT323, monospace', fontSize: '30px', color: '#F0D498' }
```

Rules that carry over unchanged:

- Only the legal sizes above. `fontSize: '18px'` is as wrong in Phaser as in CSS.
- `resolution: 1` and no `setScale()` on a text object — scaling a rasterised
  glyph resamples it. Change `fontSize` instead.
- `blur: 0` on every shadow, offset equal to the size's `--glyph`
  (24px display → 3, 16px display → 2, 30px body → 3, 20px body → 2).
- No `fontStyle: 'bold'` or `'italic'`.
- Text over the world gets a plate behind it, or the hard shadow above.

The known Phaser-side surfaces still to convert: `BootScene.createLoadingUI`,
the interaction prompt, and the location name card.
