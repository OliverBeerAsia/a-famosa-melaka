# Contributing — A Famosa: Streets of Golden Melaka

Guidelines and best practices for working on the game.

## Getting started

```bash
# Git LFS is REQUIRED before cloning (binary assets are stored in LFS)
git lfs install
git clone https://github.com/OliverBeerAsia/a-famosa-melaka.git
cd a-famosa-melaka
npm install
npm run dev        # http://localhost:3000
```

If you cloned without LFS, run `git lfs install && git lfs pull` to fetch real assets (otherwise PNG/audio files are tiny text pointers).

## Branching & PR workflow

- `main` is always releasable and protected — **do not commit directly to `main`**.
- Branch off `main` for work: `feat/...`, `fix/...`, `art/...`, `chore/...`.
- Open a PR into `main`. CI (`.github/workflows/ci.yml`) must pass before merge.
- Keep history clean: prefer fast-forward / squash; **never force-push `main`**.

## Commit messages

Conventional-style prefixes: `feat:`, `fix:`, `art:`, `chore:`, `docs:`, `ci:`.
End commit messages with the co-author trailer used in this repo.

## Quality gates (run locally; CI enforces)

```bash
npm run build         # tsc + vite + asset validation (prebuild)
npm test              # jest (pretest runs validators)
npm run validate:all  # art structural + style compliance
```

Visual changes must be **verified in-engine** (`npm run dev`) and a before/after screenshot attached to the PR — asset-file review alone is not enough.

## Graphics production (Claude-managed, no external image-gen API keys)

- **Gameplay kit** (tiles, props, sprites, portraits, UI): procedural engine in `tools/ultima8-graphics/*`.
- **Scene plates**: Canva MCP (Magic Media) generates an empty 2:1 isometric plaza → `tools/post-process-scene.cjs` quantizes + Bayer-dithers + pixelates to native 320×180 → installed to `assets/scenes/`.

```bash
# Re-derive every plate from its master export (tools/canva-sources/MANIFEST.json)
npm run scenes:rederive
# Or one plate manually:
node tools/post-process-scene.cjs <raw> assets/scenes/<scene>.png --width 960 --height 540 --spread 26 --pixelate 3
```

Do **not** introduce Gemini/OpenAI (or any external image-gen API key). Anthropic/Claude has no native image generation. See `docs/art-bible/ART_PIPELINE.md` and `ART_BIBLE.md`.

## Assets & Git LFS

Binary types (`*.png`, `*.jpg`, `*.gif`, `*.ogg`, `*.mp3`, `*.wav`, `*.aseprite`, `*.psd`, `*.docx`) are tracked by Git LFS (`.gitattributes`). Commit assets normally — LFS handles them. Keep source plate exports in `tools/canva-sources/` so plates remain reproducible.

## Releases

1. Update `CHANGELOG.md` and add `docs/RELEASE_NOTES_vX.Y.Z.md`.
2. Bump `version` in `package.json`.
3. Update `PROJECT_STATUS.md` and any affected docs.
4. Commit `Release vX.Y.Z ...`, then annotated tag: `git tag -a vX.Y.Z -m "..."`.
5. Push `main` + tag; publish a GitHub Release (`gh release create vX.Y.Z --notes-file docs/RELEASE_NOTES_vX.Y.Z.md`).

## Recommended branch protection for `main`

Enable in GitHub repo Settings → Branches (or via `gh api`):

- Require a pull request before merging (≥1 approval).
- Require status checks to pass: the **CI** workflow (`Build · Validate · Test`).
- Require branches to be up to date before merging.
- Require linear history; block force-pushes and deletions of `main`.
