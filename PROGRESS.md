# Progress

Last updated: 2026-07-21

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

The folder-app operating layer is complete and validated around the existing
application. The focused production dependency remediation is complete; no
runtime source paths were moved or renamed. The development-tooling dependency
repair is also complete and the full npm audit is clean. The macOS MLX runtime
blocker is resolved and the runtime build now verifies its own output.

## Last session (2026-07-21)

- Completed: added the three-workspace operating layer; passed normal, strict,
  and portable folder-app validation; remediated the production dependency audit;
  remediated all remaining development-tooling advisories; passed a clean
  `npm ci`, full `npm audit`, `npm run build`, and bounded Electron development
  launch; rebuilt and verified the macOS arm64 pipeline runtime with MLX Metal support.
- In progress: nothing.
- Blocked: nothing in the current local build and runtime verification scope.
- Next: produce and smoke-test a local unsigned macOS app bundle before asking
  for approval to sign, notarize, tag, or publish a release.

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

## Open questions

- Has the locally packaged unsigned macOS app bundle passed an install/launch
  smoke test with the rebuilt pipeline runtime embedded?
