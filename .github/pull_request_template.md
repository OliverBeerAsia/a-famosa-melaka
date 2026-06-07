<!-- A Famosa: Streets of Golden Melaka — Pull Request -->

## Summary

<!-- What does this PR change and why? -->

## Type of change

- [ ] Feature
- [ ] Fix
- [ ] Art / assets
- [ ] Tooling / pipeline
- [ ] Docs
- [ ] Chore / CI

## Screenshots (required for any visual/art change)

<!-- Before/after in-engine screenshots (npm run dev). Verify in the running game, not just the asset file. -->

## Checklist

- [ ] `npm run build` passes (tsc + vite + asset validation)
- [ ] `npm test` passes
- [ ] `npm run validate:all` passes (art structural + style)
- [ ] Binary assets (PNG/audio/etc.) are committed via **Git LFS** (`git lfs status` shows pointers)
- [ ] Scene plates (if changed) were produced via the documented pipeline and provenance is in `tools/canva-sources/MANIFEST.json`
- [ ] No external image-generation API keys were introduced (procedural engine + Canva MCP only)
- [ ] Docs updated (CLAUDE.md / art bible / PROJECT_STATUS / CHANGELOG) where relevant
