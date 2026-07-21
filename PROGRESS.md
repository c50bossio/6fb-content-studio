# Progress

Last updated: 2026-07-21

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

The folder-app operating layer is complete and validated around the existing
application without moving or renaming runtime source paths. The dependency and
macOS MLX runtime remediations were merged through pull request #18 at commit
`9b792a1e9aac312c5599dbff7220e62103e432f5`.

Release `v1.5.43` is published from that exact commit. Both macOS and Windows
release workflows completed successfully, all eight expected public assets are
available, and the downloaded macOS artifact passed independent checksum,
updater-metadata, notarization, Gatekeeper, embedded-runtime, and tool checks.
There is no active engineering or release blocker.

## Last session (2026-07-21)

- Completed: merged pull request #18; reran the audit, build, runtime, and
  packaged-runtime gates on exact merged `origin/main`; created and pushed
  annotated tag `v1.5.43`; completed both release workflows; verified the eight
  public assets and updater metadata; independently downloaded and certified
  the macOS release; and recorded the release evidence under `/delivery`.
- In progress: nothing.
- Blocked: nothing.
- Next: choose the next barber product outcome using recent workflow evidence,
  then write the smallest useful brief and acceptance criteria in `/product`
  before beginning implementation.

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

## Open questions

- Which barber workflow is the next product priority?
- Which workflow has the strongest recent direct barber feedback or usage
  evidence to support that choice?
