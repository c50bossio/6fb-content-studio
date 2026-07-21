# Progress

Last updated: 2026-07-21

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

The folder-app operating layer is complete and validated around the existing
application. The focused production dependency remediation is complete; no
runtime source paths were moved or renamed. The development-tooling dependency
repair is also complete and the full npm audit is clean.

## Last session (2026-07-21)

- Completed: added the three-workspace operating layer; passed normal, strict,
  and portable folder-app validation; remediated the production dependency audit;
  remediated all remaining development-tooling advisories; passed a clean
  `npm ci`, full `npm audit`, `npm run build`, and bounded Electron development launch.
- In progress: nothing.
- Blocked: the macOS packaged-runtime assertion fails because `mlx_whisper`
  cannot load its default Metal library; this was not caused by the JavaScript repair.
- Next: investigate and repair the bundled macOS Python/Metal runtime, then rerun
  the packaged-runtime assertion before a macOS packaging or release gate.

## Decisions made

- Keep the Electron, React, Python, and packaging structure unchanged.
- Use `product`, `engineering`, and `delivery` as the three work modes.
- Keep generated `release/` output separate from the `delivery/` workspace.
- Applied the supported production-only audit repair and verified the exact
  updated lockfile with a clean production audit and successful build.
- Applied the supported development-tooling repair within existing manifest
  ranges; kept the change to `package-lock.json` and verification records.

## Open questions

- Which macOS bundled-runtime packaging change will make `mlx_whisper` load its
  required Metal library consistently in the packaged runtime?
