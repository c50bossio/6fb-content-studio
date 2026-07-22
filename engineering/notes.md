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
- Renderer local-file URL encoding shipped in `v1.5.45` from merge commit
  `14be3d825f28f91edfaf18cdaf6d334e545aeeb2`.

## Open questions

- `npm test` now runs TypeScript, path-safety/clip-metadata units, IPC/static
  contracts, Python compilation/failure preflights, the packaged runtime gate,
  a production build, and an isolated real Electron IPC smoke. `npm run
  qa:visual` runs the responsive screen and interaction-state audit; its
  self-test proves layout, console, and network defects fail closed.

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
- The optional `--compose` pipeline is not part of the shipping Electron path
  and requires a separate `python/remotion` workspace. It now fails before media
  processing or Claude calls when that prerequisite is absent.
- The complete local functionality, responsive UI, and folder-app audit is
  recorded in `qa/2026-07-21-complete-project-audit.md`. The local candidate is
  committed and pushed in ready-for-review pull request #25; it has not been
  merged, tagged, deployed, packaged as a release, or published.
- External media approvals are pinned to the canonical file selected by a
  trusted native handler and app reset revokes them immediately. Assets saved by
  older builds without a pinned approval may require one native re-selection;
  they must not be silently reapproved from an untrusted renderer path.
- Pull request #25 review follow-up makes the Windows workflow run Python tests
  through the populated runtime-builder venv, permits Settings to open only the
  exact canonical App Data directory, and makes visual QA reject an unrelated
  server already occupying its configured port.
- The final pull request #25 follow-up also aligns browser-preview API contracts,
  awaits Scheduler publishing handoffs, gives every modal and mobile navigation
  complete focus containment/restoration, rejects hanging CDP requests, handles
  missing validation sources cleanly, selects Python cross-platform, and maps
  unexpected pipeline exceptions to concise nonzero CLI failures. The verified
  44 px target floor remains global because the audit contract covers every width.
