# Guided Plan-to-Post implementation plan

Status: ready for implementation

Last updated: 2026-07-21

## Goal

Connect the existing Planner, Clips, Video Editor, and Scheduler surfaces with
an explicit, local handoff contract. The change should preserve each surface's
current direct-entry behavior while allowing a barber to carry selected plan
context and finished media forward deliberately.

## Current integration points

- `src/App.tsx` owns page selection and currently passes only a selected clip
  path into `VideoEditor`.
- `src/pages/VideoPlanner.tsx` saves plans but has no navigation or handoff
  callback.
- `src/pages/ClipExtractor.tsx` can pass a selected plan's Drop Zones and
  strategy brief to extraction and can open a clip in the editor.
- `src/pages/VideoEditor.tsx` receives an initial clip and receives an exported
  output path, but exposes only Finder after a successful export.
- `src/pages/Scheduler.tsx` owns the local draft form and queue persistence.

## Handoff contract

Use a small renderer-side draft rather than a new backend service. It should
carry only data the user can already see or edit:

- optional saved plan ID, topic, and strategy context;
- media path and optional thumbnail path;
- editable caption seed; and
- source marker (`plan`, `clip`, or `editor-export`) for UI clarity and safe
  reset behavior.

Do not persist credentials, customer content beyond the existing local content
artifacts, or any implied publishing intent. A draft must be consumed or
explicitly cleared so a later direct visit cannot inherit stale media.

## Implementation sequence

1. In `src/App.tsx`, introduce a narrowly typed handoff state and callbacks for:
   - Planner → Clips with a saved plan ID; and
   - Clip/Editor → Scheduler with a local scheduling draft.
   Pass callbacks and initial handoff values only to the affected pages.
2. In `src/pages/VideoPlanner.tsx`, require a saved plan before enabling
   **Create from this plan**. If the displayed plan is not saved, save it first
   and then continue using the resulting stable plan ID.
3. In `src/pages/ClipExtractor.tsx`, accept the requested plan ID, select it
   after saved plans load, and show the current plan context. Provide a visible
   clear/replace action. Keep the existing extraction payload shape so the
   current Python bridge continues to receive `planContext` and `strategyBrief`.
4. Extend clip preview scheduling with a callback that passes the chosen clip's
   file path, thumbnail, title-derived caption seed, and provenance. Keep the
   existing direct Instagram-post action unchanged and separate.
5. In `src/pages/VideoEditor.tsx`, retain the successful render output path and
   add a schedule action beside Finder. Its draft must use that output path,
   not the pre-edit clip path.
6. In `src/pages/Scheduler.tsx`, allow `NewPostModal` to receive an optional
   draft. Prefill only editable local fields; require the existing explicit
   Schedule confirmation before calling `saveScheduledPost`.
7. Define reset behavior: opening Scheduler from its sidebar starts a blank
   draft; cancelling closes and clears a handed-off draft; a missing media path
   shows recovery UI and cannot save until the user chooses valid media.

## External-effect boundary

The feature ends at a locally saved schedule. It must not call Instagram,
Content Planner, or another external service during a Planner, Clip, Editor, or
Scheduler handoff. Existing explicit post-now behavior remains a separate,
user-initiated action.

## Verification plan

Run these after implementation:

1. `npm run build`.
2. Folder-app normal and strict validation.
3. Targeted desktop smoke using a disposable local video and no external
   posting:
   - save a plan and continue into Clips;
   - prove the selected plan's Drop Zones and strategy brief enter extraction;
   - schedule from a source clip and from a successful editor export;
   - prove the exported-file path is used after editing;
   - cancel one draft and confirm no queue record; save one draft and confirm
     exactly one local queue record;
   - open direct navigation routes and confirm there is no stale handoff.
4. If a packaged build is produced, repeat the targeted smoke against the
   packaged application; renderer-only proof is not enough for file handoffs.

## Risks and controls

- Race between loading saved plans and applying the incoming plan ID: apply the
  handoff only after the plan list resolves, and display a recoverable message
  if the ID is missing.
- Stale draft after navigation: make drafts single-use and clear them on cancel
  or explicit direct navigation.
- Accidentally scheduling the source instead of an edit: populate editor-origin
  drafts only from the render result's output path.
- Unintended publishing: do not call any posting IPC from the new callbacks.
