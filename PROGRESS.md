# Progress

Last updated: 2026-07-21

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

The folder-app operating layer is complete and validated around the existing
application without moving or renaming runtime source paths. The dependency and
macOS MLX runtime remediations were merged through pull request #18 at commit
`9b792a1e9aac312c5599dbff7220e62103e432f5`.

Guided Plan-to-Post shipped in public release `v1.5.44` from merged
`origin/main` commit `1949b06bb9f140210b2c94a93d2de899fe73e10f`. Both macOS
and Windows release workflows completed successfully and all eight expected
public assets are available. A fresh macOS arm64 download matched the published
SHA-256, passed DMG stapling and strict code-signature verification, and launched
from an isolated profile as version `1.5.44`. The visible Plan-to-Clips handoff
and the native-picker-to-Scheduler local draft flow also passed without
content-generation or social-posting calls. There is no active release or
real-Mac acceptance blocker.

## Last session (2026-07-21)

- Completed: merged pull request #18; reran the audit, build, runtime, and
  packaged-runtime gates on exact merged `origin/main`; created and pushed
  annotated tag `v1.5.43`; completed both release workflows; verified the eight
  public assets and updater metadata; independently downloaded and certified
  the macOS release; and recorded the release evidence under `/delivery`.
- Completed: Guided Plan-to-Post implementation on
  `codex/guided-plan-to-post-implementation`. Renderer handoffs, local media
  validation, local-only handoff queue loading, no-stale-navigation reset, and
  the packaged pipeline → editor export → exactly-one-local-schedule path are
  verified.
- Completed: merged pull request #21, tagged and published `v1.5.44`, and
  completed the macOS and Windows release workflows. The public macOS DMG was
  downloaded, checksum-verified, mounted read-only, notarization-validated,
  signature-verified, and launched as an isolated `1.5.44` instance.
- Completed: visible local-fallback Plan-to-Clips acceptance in the published
  app, followed by native video selection and a far-future local Scheduler draft
  saved through the released UI and removed after verification. No social post,
  browser-open fallback, remote queue, or content-generation API call was made.
- Blocked: nothing.
- Next: collect direct barber feedback for the next product cycle.

## Decisions made

- Keep the Electron, React, Python, and packaging structure unchanged.
- Use `product`, `engineering`, and `delivery` as the three work modes.
- Keep generated `release/` output separate from the `delivery/` workspace.
- Keep the source manifest's existing versioning behavior: release workflows
  stamp the tag version while packaging instead of committing generated release
  output or a release-only source-version change.
- Treat local unsigned, local signed, workflow-built, and publicly downloadable
  artifacts as separate evidence levels.
- Skip the quota-limited post-fix CodeRabbit wait by explicit owner decision;
  the actionable review threads were resolved and the remaining required local,
  merge, workflow, and public-release gates passed.
- Prioritize Guided Plan-to-Post as the next product cycle. The decision is
  grounded in the current source and release trajectory; no direct barber
  feedback or usage evidence is yet recorded.

## Open questions

- Which workflow has the strongest recent direct barber feedback or usage
  evidence to support that choice?
