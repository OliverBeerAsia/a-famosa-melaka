# Toolchain migration status, 2026-07-30

Priority: P1. Status: **not yet validated**. No migration install, disposable `npm ci`, native probe, or project check has run for this repository.

## Required lanes and checks

- Install root: this directory.
- Exact lanes: Node `20.20.2` with npm `10.9.8`, then Node `24.18.1` with npm `10.9.8`.
- For each lane, run: `npm ci`, `npm run validate:all`, `npm test -- --runInBand`, `npm run build`.
- Native probes: use `canvas@3.2.0` to create a canvas, draw, and read a pixel; assert that the Electron `28.3.3` binary exists and is executable at `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`.
- Do not launch Electron or package the application. The Vite build is the real transform probe.

Run through the reviewed central executor, which uses absolute runtime paths:

```zsh
/bin/zsh /Users/home/AI/Agents/toolchain-migration-validate.sh
```

Do not run it until it has passed review and the migration evidence contains `STAGE4_COMPLETE`.

## Safety boundary and evidence

- Validate a disposable snapshot of the current tracked and untracked, non-ignored worktree. Do not validate only `HEAD`.
- Use a separate npm cache. Do not reuse or modify this repository's existing `node_modules`.
- Do not launch GUI applications, deploy, use credentials, change services, generate project art, package releases, or alter package manifests or lockfiles.
- Preserve before/after source and package/lock checksums. Stop on any unexplained change.
- Evidence pointer: `/Users/home/.codex/audit-backups/current-toolchain-migration`
- Execution authority: `/Users/home/AI/Agents/NODE-NPM-CODEX-MIGRATION-EXECUTION-2026-07-30.md`
- Validation executor: `/Users/home/AI/Agents/toolchain-migration-validate.sh`

This handoff file is an explicitly user-authorized repository change. It is not evidence that the project has passed validation.
