# Progress

Last updated: 2026-07-21

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

The folder-app operating layer is complete and validated around the existing
application. The focused production dependency remediation is complete; no
runtime source paths were moved or renamed. The development-tooling dependency
repair is also complete and the full npm audit is clean. The macOS MLX runtime
blocker is resolved and the runtime build now verifies its own output. An
unsigned macOS arm64 app bundle has also passed local artifact and launch
smoke tests, and its embedded pipeline has passed a disposable offline
end-to-end clip-extraction smoke.

## Last session (2026-07-21)

- Completed: added the three-workspace operating layer; passed normal, strict,
  and portable folder-app validation; remediated the production dependency audit;
  remediated all remaining development-tooling advisories; passed a clean
  `npm ci`, full `npm audit`, `npm run build`, and bounded Electron development
  launch; rebuilt and verified the macOS arm64 pipeline runtime with MLX Metal
  support; built and smoke-tested an unsigned local macOS app bundle; completed
  a packaged-binary clip extraction from transcript parsing through 1080x1920
  H.264/AAC output and visually inspected frames across the rendered clip.
- In progress: nothing.
- Blocked: nothing in the current local build and runtime verification scope.
- Next: prepare the explicit signing and release-readiness gate. Signing,
  notarization, DMG creation, tagging, upload, and publishing still require
  explicit approval.

## Decisions made

- Keep the Electron, React, Python, and packaging structure unchanged.
- Use `product`, `engineering`, and `delivery` as the three work modes.
- Keep generated `release/` output separate from the `delivery/` workspace.
- Applied the supported production-only audit repair and verified the exact
  updated lockfile with a clean production audit and successful build.
- Applied the supported development-tooling repair within existing manifest
  ranges; kept the change to `package-lock.json` and verification records.
- Made the macOS runtime builder fail fast when `mlx.metallib` is unavailable
  and run the packaged-runtime assertion before reporting a successful build.
- Built the local macOS smoke bundle with identity discovery, signing,
  notarization, and publishing disabled; do not treat it as a release artifact.
- Verified the packaged pipeline offline with a local SRT and pre-seeded local
  clip selection so no external AI, research, notification, export, or posting
  action was involved.

## Open questions

- Are the Apple signing identity, notarization credentials, release version,
  and intended distribution channel ready for an explicitly approved release
  candidate build?
