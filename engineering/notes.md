# Engineering notes

Last updated: 2026-07-22

## Confirmed facts

- The renderer uses React 19 with Electron Vite and TypeScript.
- Electron owns settings, filesystem access, media rendering, scheduling,
  Instagram integration, analytics aggregation, and the Python bridge.
- `python/tools/clip_extractor/` and `python/tools/pipeline/` contain pipeline source.
- `npm run build` is the base TypeScript/Electron build gate.
- Runtime packaging has separate macOS and Windows build and assertion scripts.
- The macOS arm64 runtime builder uses the tracked
  `python/tools/clip_extractor/requirements-macos-arm64.lock` constraints. It
  pins the verified PyInstaller, SciPy, MLX, and related runtime inputs so a
  fresh release build cannot silently pick incompatible PyPI versions.
- The dependency and macOS MLX runtime remediations shipped in public release
  `v1.5.43` from merge commit
  `9b792a1e9aac312c5599dbff7220e62103e432f5`.
- Guided Plan-to-Post shipped in `v1.5.44` from merge commit
  `1949b06bb9f140210b2c94a93d2de899fe73e10f`.
- Renderer local-file URL encoding shipped in `v1.5.45` from merge commit
  `14be3d825f28f91edfaf18cdaf6d334e545aeeb2`.
- The blocked local user-key YouTube prototype has been removed. The Mac client
  now requires current versioned consent plus 6FB sign-in, makes one request to
  the fixed 6FB backend, uses official branding and accessible policy links,
  and renders validated fields as reference-only without scoring or topic use.
  The authenticated backend is implemented and locally verified on isolated
  branch `codex/youtube-trends-proxy`; the linked desktop, backend, and public
  policy PRs are #37, #125, and #152 respectively. Deployment configuration and
  authenticated staging proof remain separate gates.

## Open questions

- `npm test` now runs TypeScript, path-safety/clip-metadata units, IPC/static
  contracts, Python compilation/failure preflights, the packaged runtime gate,
  a production build, and an isolated real Electron IPC smoke. `npm run
  qa:visual` runs the responsive screen and interaction-state audit; its
  self-test proves layout, console, and network defects fail closed.

## Recent decisions

- Smart Live Trends is implemented on an isolated feature branch. Electron
  main owns bounded Google Trends RSS and authorized Instagram Graph requests;
  the renderer receives typed, source-labelled results without credentials.
  Personal Content Planner topics and offline Idea starters remain separate
  from live evidence, and the unavailable TikTok trend row is removed. The
  policy-remediated YouTube client and authenticated backend contract are
  locally proved but cannot release before deployment configuration and an
  authenticated staging response are proved. The local proof record is
  `qa/2026-07-22-smart-live-trends.md`; merge and release remain separate gates.

- Keep all implementation source in its existing runtime directories.
- House Cut thumbnail references establish a repeatable cover rule for the
  Thumbnail Maker: one claim, one visible proof cue, and one accent system.
  The GPT Image base art must remain free of text and graphic annotations so
  the editable renderer can apply the exact headline and, at most, one proof
  line or marker without creating visual clutter.
- The cover renderer must treat the model image as full-bleed editorial
  photography, not a source image behind a hard black text pane. It applies
  photographic grading, vignette and grain, a depth-aware left foreground, and
  restrained dimensional type. Image prompts explicitly reject vector-poster,
  stock-cutout, and flat-render aesthetics.
- Store only plans, architecture context, and verification evidence here.
- Applied the supported production-only audit repair: `fast-uri@3.1.4`,
  `js-yaml@4.3.0`, and `ws@8.21.1`; `npm audit --omit=dev` and `npm run build` passed.
- Applied the supported development-tooling audit repair within declared package
  ranges. The full audit is clean, the Electron production build passes, and a
  bounded development launch reached the renderer server and started the app.
- Rebuilt the stale macOS arm64 pipeline runtime so it includes MLX's
  `mlx.metallib`, and made `runtime:mac` fail if that library is unavailable or
  the completed runtime does not pass its packaged-runtime check.
- A clean v1.5.48 pre-tag rebuild exposed two dependency-drift failures before
  any tag was created: PyInstaller 6.21 attempted to thin an already arm64
  bootloader, and newer SciPy runtime imports failed after freezing. The
  macOS-only constraints restore the known-good set and are enforced by a
  static contract plus the completed packaged-runtime probe.
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
- Thumbnail Maker on `codex/thumbnail-maker` reuses `scan-library`,
  `read-transcript`, and `auto-match-carousel-frames`; it adds no transcription
  or FFmpeg pipeline. Its OpenAI Responses handler uses `gpt-5.2`, disables
  response storage, keeps a two-retry, 30-second cap, and validates exact
  counts, distinct copy, 2-4 word thumbnail text, timestamps, and
  title/thumbnail separation before renderer delivery.
- Verification evidence is recorded in
  `engineering/qa/2026-07-22-thumbnail-maker.md`. The full local suite and a
  53-state responsive matrix pass. One owner-authorized stored-key `gpt-5.2`
  source-contract call against a completed library video also passed strict
  validation. A second owner-authorized `gpt-image-1.5` acceptance call created
  and visually verified one finished 1536×1024 cover from an app-owned source
  frame; feature-branch packaging remains a separate acceptance step.
- Thumbnail Maker now treats the three concepts as a comparison set: the
  renderer can make all three finished covers sequentially, halts at the first
  error, and has a contract for the approved dark left-text/right-action
  composition. This changes neither the image model nor the published app.
- Packaged-preview acceptance selected library run `1775592631332` for `Top 3
  Tapers Video FINISHED.mp4`, generated a fresh `gpt-5.2` package, then created
  all three `gpt-image-1.5` covers through the actual renderer and IPC path.
  The live run exposed a timestamp-format gap: the post-response validator
  allowed only `MM:SS` or `HH:MM:SS`, while the JSON schema did not constrain
  the model's timestamp field. The schema now applies the same pattern and
  eight-character maximum before validation; typecheck, 15 unit tests, 71 IPC
  contracts, and the production build passed after the repair. All outputs
  remain local and no upload, schedule, or publication occurred.
- The next approved Thumbnail Maker quality pass moves exact headline typography
  out of `gpt-image-1.5` and into the renderer. The image request now asks only
  for the authentic barbering visual, while the UI provides editable headline,
  creative-lane, accent, treatment, and visual-focus controls. A local PNG
  export composes the exact app-rendered headline at 1536×864. Package
  validation requires one warning, one mistake, and one curiosity concept.
- The first real export revealed that resizing a card-sized DOM node through
  `html-to-image` paints it only in the upper-left of a larger canvas. The
  export path now renders an off-screen, fixed 1536×864 composition instead.
  Generated covers are read back only from the app-owned `thumbnail-lab` PNG
  root through a guarded IPC handler and converted to data URLs before capture;
  this prevents privileged `localfile://` fetching from dropping the visual
  during PNG composition.
- Thumbnail Maker packages now persist as validated, source-linked records in
  app-owned `thumbnail-packages` storage. The main process assigns or validates
  record IDs and timestamps, validates the three-option package again, and
  retains only frame paths under `clips` plus generated/exported PNG paths under
  `thumbnail-lab`. The renderer can list, reopen, refine, and save the local
  package without another OpenAI request.
