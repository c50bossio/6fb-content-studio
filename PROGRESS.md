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
end-to-end clip-extraction smoke. Local Developer ID signing readiness has now
also passed without notarizing or publishing an artifact. The verified branch
is pushed and pull request #18 is ready for human review. Its three CodeRabbit
findings are fixed, both inline threads are resolved, and the owner explicitly
skipped the quota-limited post-fix CodeRabbit wait. The adversarial
merge-readiness review passed. No merge, release tag, notarization, or
publication has occurred.

## Last session (2026-07-21)

- Completed: added the three-workspace operating layer; passed normal, strict,
  and portable folder-app validation; remediated the production dependency audit;
  remediated all remaining development-tooling advisories; passed a clean
  `npm ci`, full `npm audit`, `npm run build`, and bounded Electron development
  launch; rebuilt and verified the macOS arm64 pipeline runtime with MLX Metal
  support; built and smoke-tested an unsigned local macOS app bundle; completed
  a packaged-binary clip extraction from transcript parsing through 1080x1920
  H.264/AAC output and visually inspected frames across the rendered clip;
  audited current release state; completed a local signed-candidate proof;
  opened pull request #18; addressed all three CodeRabbit findings; and passed
  an exact-head adversarial merge-readiness review.
- In progress: nothing.
- Blocked: nothing in the current local build and runtime verification scope.
- Next: explicitly approve merging pull request #18, then verify and rerun the
  audit, build, runtime, and packaged-runtime gates on the exact merged
  `origin/main` commit. Creating the proposed `v1.5.43` tag remains a separate
  gate that will trigger signing, notarization, macOS and Windows packaging,
  upload, and publishing.

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
- Used the matching Developer ID identity to sign an unpacked local candidate,
  with notarization and publishing explicitly disabled, and verified its strict
  signature, hardened runtime, embedded tools, and bounded launch.

## Open questions

- Should ready pull request #18 be merged to `main` after its post-fix reviews,
  then released through the existing tag workflows as `v1.5.43`?
