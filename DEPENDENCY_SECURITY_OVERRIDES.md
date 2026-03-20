# Dependency Security Overrides

Date: 2026-03-14

This repo uses `npm overrides` in `package.json` to patch vulnerable transitive `minimatch` copies used by packaging, archive, and test tooling.

Overrides in place:
- `@electron/asar` -> `minimatch@3.1.4`
- `@electron/universal` -> `minimatch@3.1.4`
- `app-builder-lib` -> `minimatch@5.1.8`
- `config-file-ts` -> `glob` -> `minimatch@9.0.7`
- `dir-compare` -> `minimatch@3.1.4`
- `filelist` -> `minimatch@5.1.8`
- `glob` -> `minimatch@3.1.4`
- `readdir-glob` -> `minimatch@5.1.8`
- `test-exclude` -> `minimatch@3.1.4`

Why these were chosen:
- The findings were in transitive packages used by the build and packaging stack.
- The overrides stay within the same major lines already required by the direct parents.

Validation steps:
- `npm install --package-lock-only`
- `npm audit --audit-level=moderate`
- `npm run build`
- `npm test`

Removal guidance:
- Remove these only after the build and packaging dependencies resolve to fixed subdependencies without manual overrides.
