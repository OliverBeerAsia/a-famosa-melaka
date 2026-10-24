# Dependency maintenance candidate, 24 October 2026

This change is separate from the merged Node 22.23.4 CI pin. It updates Electron 28 to 45, electron-builder 24 to 26, Vite 5 to 7, Vitest 1 to 4, the matching React plugin, PostCSS and compatible transitive dependencies. No game or art source is changed.

## Selector-parser audit discrepancy

The npm advisory currently marks all versions below 7.1.6 as affected by GHSA-rj75-hqrm-r3gf. The upstream maintainer explicitly backported the fix to 6.1.5 for Tailwind CSS 3: https://github.com/postcss/postcss-selector-parser/releases/tag/6.1.5 . The scoped override keeps the existing 6.x API and selects that patched backport. Every installed 6.x parser instance must resolve to 6.1.5.

Do not report a zero audit if npm still lists postcss-selector-parser, postcss-nested and tailwindcss. Those three moderate entries represent this same transitive advisory, not three independent flaws. Recheck the upstream advisory and installed versions before removing the override or closing this exception. Other audit findings must not be suppressed.

## Acceptance and release boundary

Locked installation, asset validation, all 410 tests and production build are required. A bounded unsigned Mac package check is separate from signed distribution. Electron's breaking-change reference is https://www.electronjs.org/docs/latest/breaking-changes . The preload exposes explicit IPC wrappers and imports only electron; it does not use the Node shims removed from sandboxed preloads in Electron 45. This source check does not replace a native run.

Keep this change draft until packaged-game startup, existing-save loading, save/reload, window controls and representative gameplay are accepted. Windows/Linux packaging and signing/notarization remain release-platform checks, not claims made by a Mac source build. No binary publication is authorized by this candidate.

Rollback: return package.json and package-lock.json together to main before this PR, reinstall with npm ci, and rebuild. Retain existing user saves; do not delete or migrate them as part of dependency rollback.

## Candidate results

Final npm ci, 410 tests, asset gates, production build and unsigned macOS arm64 packaging passed. The ASAR contains electron/main.cjs, electron/preload.cjs and dist/index.html. The old global/scoped glob and minimatch overrides were removed because they forced incompatible API majors into the upgraded builder; packaging verification caught omitted application files before this correction. The parser backport produced identical CSS. Native gameplay/save acceptance has not been run.
