# Thumbnail Maker implementation plan

Last updated: 2026-07-22

## Runtime changes

- Add a typed Thumbnail Maker renderer page and route it through the existing
  sidebar and dashboard.
- Add one bounded OpenAI Responses API handler for transcript packaging and one
  local Markdown export handler.
- Add one bounded GPT Image edit handler for a user-selected concept. It must
  accept only an app-owned local source frame, generate the visual without AI
  typography, and save the source visual under Content Studio's app data.
- Add renderer-owned exact headline composition and PNG export so the user can
  edit the creative lane, accent, treatment, and visual focus without relying
  on image-model spelling or layout.
- Encode the House Cut cover standard in both generation prompts and renderer:
  one dominant 2-4 word headline, one transcript-grounded proof cue, and one
  accent system. The source art stays free of generated text or annotations;
  renderer treatments supply at most one line or one marker ring.
- Compose exports from an off-screen, fixed 1536×864 renderer canvas. Hydrate
  only app-owned generated PNGs from `thumbnail-lab` as data URLs before
  capture, so Electron's privileged local-file protocol cannot omit the visual.
- Reuse `read-transcript`, `scan-library`, and
  `auto-match-carousel-frames`; do not add a new transcription or FFmpeg path.
- Validate the AI response in a pure module before returning it to the renderer.
- Persist each completed three-option package as a validated JSON record under
  app-owned storage. The main process owns record IDs, timestamps, and local
  path checks; the renderer can list, reopen, refine, and explicitly save the
  record without rerunning OpenAI.

## Verification

- Unit-test exact counts, distinct warning/mistake/curiosity lanes, duplicate
  rejection, word limits, timestamp rules, title/thumbnail separation, and
  Markdown serialization.
- Extend IPC contract proof automatically through preload/main parity.
- Run typecheck, unit tests, contract tests, production build, Electron IPC
  smoke, and responsive visual QA.
- Unit-test saved-record validation and reject invalid IDs/timestamps. Extend
  IPC contracts for the save/list/load library boundary.
