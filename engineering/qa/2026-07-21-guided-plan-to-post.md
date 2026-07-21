# Guided Plan-to-Post renderer smoke — 2026-07-21

## Scope

Verify the new local handoff boundaries between Video Planner, Clip Extractor,
Video Editor, and Scheduler without posting or calling a content-generation
service. This record covers both the renderer smoke and signed, packaged macOS
handoff acceptance, including one isolated local scheduling record.

## Safety controls

- Ran the Electron app in development mode with a local Chrome DevTools port.
- Stubbed only the renderer's plan persistence and generation methods for the
  planner handoff smoke. The stub existed only in the running process and did
  not write a plan or queue record to application storage.
- Did not click Schedule, Post Now, Post as Reel, or any action that invokes a
  social-posting API.
- Tested the new media validation IPC against a non-existent `/tmp` path.
- Handed-off Scheduler entry uses the local queue IPC rather than the existing
  remote-aware queue refresh used for direct Scheduler navigation.
- Packaged-app QA sets `SIXFB_DISABLE_AUTO_UPDATES=1`, a test-only automatic
  update-check guard. Normal production launches retain their existing updater
  behavior.

## Result

PASS for the implemented renderer handoff and missing-media guard.

- `npm run build` completed successfully.
- Folder App doctor completed with exit `0` in both normal and
  `--warn-as-error` modes.
- The desktop smoke generated a fallback plan, used **Create from this plan**,
  and landed in Clips with the saved plan ID selected and its topic present in
  the plan selector.
- Clip-origin and editor-export handoff drafts each opened Scheduler with their
  respective provenance label and editable caption seed.
- `check-media-file` returned `{ success: false, exists: false }` with the
  recovery message for a missing local file; the recovery state was visible in
  the Scheduler modal and its Schedule button stayed disabled.
- The local publishing queue IPC returned `source: local`; handed-off
  Scheduler entry is wired to that IPC instead of the remote-aware refresh.

## Packaged source-to-schedule acceptance

PASS.

- Generated a disposable 52-second H.264/AAC source fixture with the packaged
  FFmpeg runtime and supplied a local transcript plus an existing local clip
  selection. The packaged pipeline produced a real vertical clip at
  `clip-01-Clean-Fade-Process/reframed-9x16.mp4`; its `--no-post` invocation
  used no cloud AI or publishing service.
- Opened that exact generated clip in the signed packaged Video Editor and
  used the visible **Export Video** control. It produced
  `6fb_edit_1784662071898.mp4` successfully.
- Used the visible **Schedule exported video** control. Scheduler displayed
  **From Video Editor export** and **Media is available** for that exact
  exported path.
- The isolated local queue was empty immediately before save. One visible
  **Schedule** click created exactly one local Instagram record with status
  `scheduled`, origin `local`, and media path
  `/Users/bossio/Downloads/6fb_edit_1784662071898.mp4`.
- No post-now or social-post action was clicked. The test profile and exported
  fixture are removed after evidence capture.

## Packaged macOS handoff smoke

PASS.

- `npm run package:mac` completed. The embedded darwin-arm64 runtime assertion
  and code-signature verification passed. Notarization was skipped because the
  local build did not have notarization options.
- A disposable two-second H.264/AAC MP4 was created in the app-owned data
  directory, then checked through the packaged app's real media-validation IPC
  (`success: true`, `exists: true`).
- Packaged Clip and Video Editor handoff drafts each showed the expected source
  label, exact caption seed, and **Media is available** state. Schedule became
  available only as an explicit user action; it was not clicked.
- Clicking Scheduler directly while a handoff draft was open cleared the draft
  and closed the modal.
- The local queue count was `0` before the smoke and `0` after cancellation.
  No schedule or social-posting action ran.

## Release-proof status

All planned local and packaged acceptance gates for this change have passed.
Merge, release, distribution, and real social posting remain separate,
unapproved gates.
