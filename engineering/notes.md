# Engineering notes

Last updated: 2026-07-21

## Confirmed facts

- The renderer uses React 19 with Electron Vite and TypeScript.
- Electron owns settings, filesystem access, media rendering, scheduling,
  Instagram integration, analytics aggregation, and the Python bridge.
- `python/tools/clip_extractor/` and `python/tools/pipeline/` contain pipeline source.
- `npm run build` is the base TypeScript/Electron build gate.
- Runtime packaging has separate macOS and Windows build and assertion scripts.
- The dependency and macOS MLX runtime remediations shipped in public release
  `v1.5.43` from merge commit
  `9b792a1e9aac312c5599dbff7220e62103e432f5`.
- Guided Plan-to-Post shipped in `v1.5.44` from merge commit
  `1949b06bb9f140210b2c94a93d2de899fe73e10f`.

## Open questions

- There is no dedicated test script in `package.json`; feature verification must
  currently combine build checks with targeted smoke or manual flows.

## Recent decisions

- Keep all implementation source in its existing runtime directories.
- Store only plans, architecture context, and verification evidence here.
- Applied the supported production-only audit repair: `fast-uri@3.1.4`,
  `js-yaml@4.3.0`, and `ws@8.21.1`; `npm audit --omit=dev` and `npm run build` passed.
- Applied the supported development-tooling audit repair within declared package
  ranges. The full audit is clean, the Electron production build passes, and a
  bounded development launch reached the renderer server and started the app.
- Rebuilt the stale macOS arm64 pipeline runtime so it includes MLX's
  `mlx.metallib`, and made `runtime:mac` fail if that library is unavailable or
  the completed runtime does not pass its packaged-runtime check.
- Ran the unsigned app bundle's embedded pipeline end-to-end against a
  disposable offline fixture. Transcript parsing, boundary validation, clip
  extraction, crop-path analysis, and 1080x1920 H.264/AAC rendering completed;
  external selection, posting, notifications, and exports were not invoked.
- The next approved product scope is Guided Plan-to-Post. Its implementation
  plan keeps plan, clip, editor, and Scheduler handoffs local and requires
  explicit scheduling or posting confirmation.
- The published macOS `v1.5.44` bundle passed isolated launch, bundled-runtime
  health, and the visible Plan-to-Clips handoff using a forced local planner
  fallback. A disposable fixture selected through the native picker passed
  approved-path validation, then saved and removed a far-future local Scheduler
  draft through the released UI. No external posting route ran.
