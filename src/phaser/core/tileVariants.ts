/**
 * Tile variant manifest type.
 *
 * The only surviving export of the deleted `src/systems/TileVariantSystem.ts`
 * (part of the dead parallel JS/TS codebase removed in Stage 1). BootScene uses
 * it to type `runtime-asset-manifest.json`'s `tileVariants` block:
 * `{ "<tile prefix>": <variant count> }`.
 */
export type TileVariantManifest = Record<string, number>;
