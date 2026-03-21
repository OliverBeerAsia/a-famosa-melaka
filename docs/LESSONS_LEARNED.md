# Lessons Learned

## March 2026 Customs Spine Pass

### 1. Reactive state only matters when routes and dialogue consume it

The old world-state problem was not storage. It was usage. The customs pass got better the moment route access, greeting tone, branch gates, and journal presentation all started consuming the same flags and outcomes.

### 2. Implicit faction presentation is stronger than raw bars here

Showing `City Currents` as qualitative pressure works better for this game than exposing naked meters in the HUD. It preserves atmosphere while still making consequence legible.

### 3. Save migration is part of feature work, not cleanup

Changing the reputation model from four coarse groups to six meaningful blocs would have been irresponsible without migration. Persistent RPG state is product surface, not an internal detail.

### 4. New content needs runtime placement and asset coverage immediately

Adding quest-bearing NPC JSON was not enough. The moment the new customs cast had map positions, portraits, sheets, and validation coverage, the feature became a real shipping slice instead of a half-integrated design note.

### 5. Stopgap art is acceptable only when it is explicitly temporary

Using derivative local assets for the four new customs NPCs was the right short-term move to keep the build coherent and releasable, but those files now belong on the top-priority replacement list.

## March 2026 Graphics and Polish Pass

### 1. A single hero slice is not enough

`Rua Direita` looking good did not make the game look good overall. Players judge the build by the weakest transition corridor as much as by the strongest screenshot. World parity matters more than one standout location.

### 2. Graphics quality is inseparable from interaction feel

Movement response, prompt clarity, dialogue staging, and travel presentation all change how expensive or cheap the art feels. Better art cannot compensate for weak control feel.

### 3. Historical specificity beats generic prettiness

The best improvements were not random clutter. They were placements that implied real uses: artillery staging, prayer spaces, cargo handling, market frontage, domestic work, and religious processions.

### 4. UI placeholders poison the rest of the experience

Missing item icons and inconsistent portraits made the build feel more unfinished than some larger environmental gaps. UI-facing art needs the same discipline as world art.

### 5. Validation needs to cover visual regressions

Strict art validation and visual integrity tests caught exactly the sort of regressions that would otherwise creep back in: thin map dressing, missing portraits, and incomplete item-art coverage.

### 6. Documentation drift is a real production bug

Several docs were still describing an earlier prototype architecture and older design target. That makes releases harder, onboarding worse, and quality bars ambiguous. Release work now has to include doc alignment as a first-class task.
