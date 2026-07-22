# Complete project audit

Date: 2026-07-21

## Discovery map

6FB Content Studio is a mixed Electron/React desktop app, Python media pipeline,
release toolchain, and folder-app operating workspace that lets barbers plan,
create, edit, schedule, publish, and measure content.

All three audit phases apply: runnable functionality, responsive UI/UX, and
instructions/folder-app routing.

### Surfaces and integrations

- Renderer routes/features: Setup, Dashboard, Video Planner, Clip Extractor,
  Carousel Studio, Blog Writer, Video Editor, Brand & Brain, Analytics,
  Scheduler, and Settings.
- Desktop boundary: 68 preload-to-main IPC channels, native file/folder pickers,
  the guarded `localfile://` media protocol, app profile/settings persistence,
  OS open/show actions, scheduler daemon, and updater.
- Media boundary: Python clip pipeline, transcript parsing, selection import,
  boundary validation, face/saliency tracking, FFmpeg/ffprobe rendering, library
  scanning, thumbnails, editor export, and optional Remotion composition.
- External boundary: Anthropic/OpenAI generation, 6FB Content Planner/Manager,
  Instagram Graph publishing/analytics, and GitHub-backed updates/releases.
- Operating/release files: root routing and handoff, `/product`, `/engineering`,
  `/delivery`, runtime builders, package scripts, and macOS/Windows tag workflows.

### Critical-flow matrix

| Critical flow | Boundaries exercised | Clean proof |
|---|---|---|
| First run and settings | Packaged renderer asset, preload, isolated Electron profile, key metadata | `npm run test:electron`; Setup image loaded from `file://`, isolated `userData` matched, settings path stayed private. |
| Plan to clip to editor to schedule | Planner UI, approved source, bundled Python/FFmpeg, local library, editor validation/export, scheduler persistence | No-post pipeline render below; prior five-second editor artifact below; Electron smoke saves, reloads, deletes a disposable scheduled post and rejects an invalid trim. |
| Carousel/blog creation and export | AI client guards, approved images, JSON persistence, deck/Markdown exports | 68 executable/static IPC contracts plus asset-path and ID validators; browser states captured at all widths. No paid API generation was required for the audit. |
| Local library and analytics | Run scanning, transcripts, thumbnails, local counts, guarded remote analytics | Owned-path/symlink unit tests, Electron protocol smoke, bounded external-client contracts, Analytics screen capture. |
| Publishing and external services | Local queue, browser-open fallback, Instagram upload/poll/publish, Content Manager, updater | Local lifecycle passed; unsupported platforms and unapproved/missing media fail. External requests have timeouts/retry caps. No production post, message, update, or release was triggered. |

Referenced but intentionally absent: `python/remotion` is an optional workspace,
not part of the shipping FFmpeg path. `--compose` fails before media or external
work and names every missing prerequisite. No other referenced source path is
missing. Windows-host execution and a fresh public `v1.5.45` installer
certification remain separate release gates and are not claimed here.

## Functionality proof

Final repeatable gate:

```text
npm test
  TypeScript: PASS
  path-safety and clip-metadata unit tests: 9/9 PASS
  IPC/contracts: 68 channels PASS
  documentation: 13 required paths, 31 source Markdown files PASS
  Python compile and failure preflights: PASS
  packaged runtime assertion: PASS
  Electron production build: PASS
  isolated packaged Electron IPC smoke: PASS
```

The Electron smoke proves the packaged Setup artwork, profile isolation,
electron-store non-disclosure, `localfile://` 403 for both `config.json` and a
clips-directory symlink escape, 200/206 for owned media, a persisted exact-file
approval pinned to its original canonical target, 403 after symlink retargeting,
and immediate approval revocation after app reset. It also proves rejected
settings-file open, invalid scheduler input, scheduler create/read/delete,
mismatched and cross-linked trim rejection, one-winner concurrent trim locking,
exact-once metadata updates, uppercase `.MP4` handling, and video-stream duration
matching after accurate transactional re-encoding, including rejection when
longer audio hides truncated video. It uses a disposable OS temp directory and
removes it.

Additional clean commands:

```text
npm audit --audit-level=low
npm run validate:workspace
npm run validate:workspace:strict
npm run validate:workspace:portable
git diff --check
```

Dependency audit reports zero vulnerabilities. All three workspace modes exit
zero with no findings.

### No-post bundled media acceptance

The run reused a fixed, previously generated selection fixture so the media
pipeline could be verified without an API request. Its SHA-256 is
`e9f9c96904b861c9bfb539861ec353fc13dff4be249adcc8488c0af48f2a1225`.

```bash
audit_tmp_dir=$(mktemp -d /tmp/6fb-final-media.XXXXXX)
mkdir -p "$audit_tmp_dir/output"
cp /tmp/6fb-phase1-pipeline.GLb4Ej/output/clip_selections.json "$audit_tmp_dir/output/clip_selections.json"
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY \
  python/runtime/darwin-arm64/pipeline/6fb-pipeline/6fb-pipeline \
  --video /tmp/6fb-phase1-pipeline.GLb4Ej/fixture.mp4 \
  --transcript /tmp/6fb-phase1-pipeline.GLb4Ej/fixture.srt \
  --brand 6fb --clips 1 --format 9x16 --no-post --no-logo \
  --output "$audit_tmp_dir/output"
```

The binary printed `Post: No (dry run)` and `--no-post: Nothing was published`.
`ffprobe` reported H.264 video, AAC audio, 1080x1920, and 50.006 seconds. The
rendered clip SHA-256 is
`cccd2a4434003c76cb08f7b63e9336a792c23b0e58fd53de3f53700a49369a65`.

The earlier disposable Editor export remains H.264/AAC, 1080x1920, 5 seconds,
SHA-256 `90e38693892cd4fce0db31cc90ff6e63045ac03a0b2b5b4c9a262afcfd63d4db`.

One negative pipeline probe exposed a real defect: an AI-selection failure
returned a failed result while the CLI exited zero. The CLI now maps explicit
stage failure and successful-looking zero-output results to exit 1. Requested
composition, rendering, studio export, notifications, and research
all fail the run when incomplete; research is opt-in and checks prerequisites;
direct `--post` fails closed in favor of the reviewed desktop publishing flow.
Unsupported formats and nonpositive clip counts exit 2, while all five supported
formats (`9x16`, `1x1`, `4x5`, `split`, and `auto`) route unchanged. Source and
bundled-runtime probes cover exit 0/1/2 behavior. Only the original bounded AI
request occurred; it was not retried.

## UI/UX proof

Canonical local artifacts are `out/qa/final-proof/report.json` and the three
`out/qa/final-proof/contact-*.png` sheets. They remain in the existing ignored
generated-output directory by project rule; hashes below make the exact local
evidence identifiable.

- 47 screenshots: all 11 screens at 375, 768, and 1440 px, plus focused Setup
  validation, Planner loading, Scheduler hover/modal, and mobile navigation.
- Result: 0 console errors, 0 network errors, 0 overlays, 0 horizontal overflow,
  0 clipped-text controls, and 0 visible targets below 44 px.
- The gate self-test injects a sub-44px target, `console.error`, and a failed
  localhost request; `npm run qa:visual:self-test` passes only when the audit
  records all three classes and exits nonzero.
- Contact-sheet/report hashes:
  - report: `21a5338d4b44478d353919705424ee47682401bfd8e1994b698a9581955b78bd`
  - 375 px: `2aefe73db62142a2471c2f73afb79c701fe8f10bb9b0cc4b70bcb6db0302176b`
  - 768 px: `ff2f22f853ef33fe94f777426a6317a8a0526b96a88d97fce5b33b3c3e27299f`
  - 1440 px: `d352bda7e3d3b59c1adf64326f4b66ea30ed2f1735f8d50daedec6ed1518c4ed`

The phase completed within the ten-loop safety limit. No fix approach failed
three times.

## Folder-app and instruction proof

`npm run validate:workspace`, `npm run validate:workspace:strict`, and
`npm run validate:workspace:portable` all exit zero. `npm run test:docs`
validates 13 required paths, 31 source Markdown files, routing, local links, and
README/npm command references. Missing Chrome and missing folder-app skill paths
both fail with exact remediation text.

### Trigger tests

| Request that must trigger folder-app | Result |
|---|---|
| Run the workspace doctor and make this folder app portable. | PASS — folder-app validation; evidence routes to `/engineering`. |
| Add a new workspace area to this model-independent folder app. | PASS — folder-app plan/approval workflow. |
| Convert these instructions into a Claude/Codex-compatible folder router. | PASS — folder-app portability workflow. |
| Reorder a human-review stage in this folder pipeline. | PASS — folder-app stage-change gate. |
| Audit the folder-app pickup and handoff contract. | PASS — folder-app validation at root. |

| Request that must not trigger folder-app | Result |
|---|---|
| Fix the Settings renderer crash. | PASS — `/engineering`, ordinary app implementation. |
| Define Scheduler mobile UX acceptance criteria. | PASS — `/product`. |
| Package and notarize the next macOS release. | PASS — `/delivery` plus explicit approval. |
| Diagnose clip extraction quality. | PASS — `/engineering`, Python pipeline. |
| Post this carousel to Instagram now. | PASS — explicit runtime approval, not folder-app work. |

Result: 5/5 positive and 5/5 negative triggers route without guessing.

## Remaining release boundaries

No local implementation or instruction blocker remains. The pull request is not
a merge, deployment, tag, package publication, social post, or updater release.
A legacy external asset saved before canonical approval pinning is not silently
trusted; the user may need to select it once through the native picker. This is
an intentional security migration, not data deletion.
A Windows runner will execute the full suite in the tag workflow, but this local
macOS audit does not claim a Windows-host pass. The latest independently
downloaded, signed, launched public DMG remains `v1.5.44`; live `v1.5.45`
metadata/workflows/assets were verified separately without certifying its DMG.
