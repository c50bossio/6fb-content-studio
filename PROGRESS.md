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
smoke tests.

## Last session (2026-07-21)

- Completed: added the three-workspace operating layer; passed normal, strict,
  and portable folder-app validation; remediated the production dependency audit;
  remediated all remaining development-tooling advisories; passed a clean
  `npm ci`, full `npm audit`, `npm run build`, and bounded Electron development
  launch; rebuilt and verified the macOS arm64 pipeline runtime with MLX Metal
  support; built and smoke-tested an unsigned local macOS app bundle.
- In progress: nothing.
- Blocked: nothing in the current local build and runtime verification scope.
- Next: run a bounded end-to-end clip-extraction smoke against the packaged
  pipeline using a disposable local fixture, then prepare the explicit
  signing/release gate.

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

## Open questions

- Does the packaged pipeline complete a disposable local clip-extraction fixture
  and produce inspectable outputs without using external APIs?
