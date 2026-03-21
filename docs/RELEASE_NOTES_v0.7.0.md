# Release Notes: v0.7.0

**Date:** March 21, 2026

## Release Theme

This release is where the game stops treating quest state as mostly decorative. The customs/corruption spine is now live across the market, quay, fortress gate, and kampung edge, and the first practical RPG foundation is finally integrated into the real runtime instead of sitting in design docs.

## Highlights

### 1. The customs spine is now a real quest cluster

- Added `The Customs Ledger` as a four-resolution quest:
  - expose the books
  - broker the balance
  - bury the trail
  - follow the trail
- `The Merchant's Seal`, `Rashid's Cargo`, and `Pirates on the Horizon` now feed the same harbor/customs state instead of behaving like isolated side stories
- Consequences now persist as route access, witness trust, and later quest hooks

### 2. The first implicit faction model shipped

- The game now uses six factions:
  - `garrison`
  - `church`
  - `portuguese-merchants`
  - `chinese-merchants`
  - `kampung-community`
  - `dockside-network`
- Old saves are migrated into the new schema
- The UI surfaces faction pressure through `City Currents` rather than raw numerical bars

### 3. The world now reacts more convincingly

- `A Famosa Gate <-> Waterfront` now includes a visible-but-locked service route that opens through customs-related world state
- `Rua Direita`, `Waterfront`, and `A Famosa Gate` now have stronger customs-era dressing, paperwork spaces, and world-item affordances
- Four new named support/witness NPCs were added to the live cast:
  - `Gaspar Mesquita`
  - `Diogo Almeida`
  - `Lin Mei`
  - `Pak Salleh`

### 4. Validation and release discipline improved again

- New regression checks cover customs-ledger path structure, witness dialogue presence, and service-route lock state
- Build, tests, and strict art validation are all green on the release candidate

## Verification

The release candidate passed:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

## What This Release Does Not Finish

- The four new customs-spine portraits and gameplay sheets are still stopgap local derivatives, not bespoke final art
- `Pirates on the Horizon` is a better follow-on hook now, but not yet the deeper Phase 2 rebuild
- `St. Paul's Church` and `Kampung` still need the same level of reactive quest integration now present in the customs spine
- Manual full-playthrough feel review remains necessary after automation passes
