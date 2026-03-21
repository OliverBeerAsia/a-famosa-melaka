# Release Notes: v0.6.0

**Date:** March 21, 2026

## Release Theme

This release is the point where the game stops reading like one polished hero street surrounded by supporting prototypes. The world now holds together much better as a five-location playable slice, with stronger map parity, item-art coverage, and presentation flow.

## Highlights

### 1. World parity improved

- `A Famosa Gate` now has a fuller fortress read with richer live layers and more authored spread toward its transition corridor
- `St. Paul's Church` now has stronger sacred-route composition and no longer feels like a lightly dressed connector
- Shared environment and historical object data were extended so both maps feel more intentionally used

### 2. Item presentation completed

- Every player-facing item now has a UI icon
- Phaser now loads those item icons so world pickups can present closer to the inventory identity of the item
- This removes a major source of placeholder feel

### 3. Opening flow improved

- HUD clutter was reduced in the opening path
- First-use hints are more contextual
- Arrival and transition screens are staged differently
- Interaction prompt language is clearer and more specific

### 4. Documentation caught up to the product

- The core docs now describe the live TypeScript/Phaser runtime instead of the older prototype-era architecture
- Added explicit release notes, lessons learned, and a medium-term TODO

## Verification

The release candidate passed:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

## Artifacts

- `A Famosa Streets of Golden Melaka-0.6.0-arm64.dmg`
  - SHA-256: `47264a6d905aee91deffca24968078c8426c5543a637b31fe4bee40fc50e7f31`
- `A Famosa Streets of Golden Melaka-0.6.0-arm64-mac.zip`
  - SHA-256: `f83a34222dec92316aa600e2e2d6fd9ee3b9e0059feb8df7c15df924647a4823`

These macOS artifacts are packaged but unsigned.

## What This Release Does Not Finish

- It does not complete the second-pass redraw of the named gameplay sheets
- It does not finish the full believability pass for schedules, social behavior, and reactive dialogue
- It does not replace manual playthrough review; experiential QA still matters
