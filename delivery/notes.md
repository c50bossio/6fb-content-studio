# Delivery notes

Last updated: 2026-07-22

## Confirmed facts

- The source `package.json` reports version `1.5.39`; tag workflows stamp the
  release version while packaging.
- `.github/workflows/release.yml` coordinates macOS-arm64-only `v*` releases:
  it stages exactly four Mac assets in a draft, smoke-checks the notarized DMG
  from that draft, and only then publishes.
- `.github/workflows/release-windows.yml` is a manual, non-publishing future
  Windows build/test/package validator. It is not callable from the production
  tag workflow.
- Generated package output belongs in ignored `release/`.
- Pull request #18 merged to `main` as
  `9b792a1e9aac312c5599dbff7220e62103e432f5` on 2026-07-21.
- Annotated tag `v1.5.43` resolves to that exact merge commit.
- `v1.5.43` and `v1.5.44` are superseded by `v1.5.45` as the current non-draft,
  non-prerelease public release.
- The macOS and Windows release workflows both completed successfully on the
  exact tagged commit and published all eight expected assets.
- Independent public-download certification verified the DMG and updater ZIP
  checksums, updater metadata, notarization stapling, strict code signature,
  Gatekeeper acceptance, application identity, embedded runtime, FFmpeg,
  FFprobe, and MLX Metal library.
- Independent Windows-host execution was not part of this macOS closeout. The
  Windows claim is limited to successful workflow execution, published assets,
  and public checksum evidence.
- Pull request #21 merged to `main` as
  `1949b06bb9f140210b2c94a93d2de899fe73e10f` on 2026-07-21.
- Annotated tag `v1.5.44` resolves to that exact merge commit. The release was
  published on 2026-07-21 at 19:43:54 UTC.
- macOS workflow run `29862361704` and Windows workflow run `29862361789`
  completed successfully. The public release contains all eight expected
  macOS and Windows assets and updater metadata.
- A fresh public macOS DMG download matched the release API SHA-256, passed DMG
  stapling and strict app signature verification, and launched from a disposable
  profile as version `1.5.44`.
- Annotated tag `v1.5.45` resolves to merge commit
  `14be3d825f28f91edfaf18cdaf6d334e545aeeb2`. The release was published on
  2026-07-21 at 20:49:44 UTC.
- macOS workflow run `29867007398` and Windows workflow run `29867008468`
  completed successfully for that exact commit. The public release contains all
  eight expected macOS and Windows assets and updater metadata.
- This audit verified the live release metadata and workflow conclusions but did
  not independently download and certify the 417 MB `v1.5.45` DMG. The most
  recent independent DMG launch/signature certification remains `v1.5.44`.
- Prepared `v1.5.46` baseline is exact `origin/main` commit
  `1ca93cf2abaf6b4be629c5203d8dbee3fc00b69a`, which includes pull requests #25
  through #28. The final tag target must be the exact verified `origin/main`
  commit after the macOS-only change is reviewed and merged.
- `delivery/checklists/v1.5.46-release-readiness.md` and
  `delivery/release-notes/v1.5.46.md` define the release candidate gates and
  draft copy. They do not authorize or claim a tag or publication.
- v1.5.46 is now macOS arm64 only. The coordinated workflow can make the release
  public only after exactly four Mac artifacts exist and the staged DMG passes
  stapling, signature, Gatekeeper, and version checks. The tracked release-note
  file is the public release body.
- No `v1.5.46` tag, GitHub Release, or public artifact exists. Non-publishing
  Windows run `29937539545` is the first clean semantic preflight and passed on
  exact code commit `95a34de2faf8cf53d42a0318580a79601502fa23`, including
  runtime build, strict source and frozen UTF-8 probes, full suite, v1.5.46
  package, packaged-app launch/system-health smoke, and upload of four files.
  The downloaded artifact manifest and hashes are recorded in
  `delivery/evidence/2026-07-22-v1.5.46-release-prep.md`.
- Earlier workflow-success run `29935424714` was false-green for four Python
  negative paths because Windows `charmap` failures satisfied exit-code-only
  assertions. Python stdio, Electron pipe decoding, Windows CI, and source and
  frozen regression tests now enforce valid UTF-8 and exact intended errors.
- Exact final release-coordinator code commit
  `b06b0947fab202eb31099567e9dc32a340bb56eb` disables persisted credentials in
  every checkout. Its complete local suite, dependency audit, actionlint, YAML,
  shell, and workspace checks pass. The application/runtime and Windows package
  implementation remain those tested in run `29937539545`; the macOS-only
  change removes Windows from production orchestration and makes its validator
  manual-only.
- The owner deferred Windows distribution and Authenticode signing until Mac
  adoption justifies that platform. Draft Azure-signing pull request #29 was
  closed without merge; its branch remains recoverable for later reference.
- The signed-in Azure tenant showed zero subscriptions at the decision point.
  No Artifact Signing resource, repository signing setup, signing workflow, tag,
  GitHub Release, or public v1.5.46 artifact was created during that exploration.

## Open questions

- What exact post-preparation `origin/main` commit will be approved as the
  `v1.5.46` tag target?
- What adoption threshold should trigger reconsidering a Windows release?

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
- Keep unsigned local, signed local, workflow-built, and externally published
  artifact claims separate.
- Treat CodeRabbit's post-fix quota failure as an optional external-capacity
  limit, not a code failure; do not weaken required local or post-merge verification.
- Record the absence of an independent Windows-host launch smoke explicitly
  instead of implying that macOS verification exercised Windows binaries.
- Publish v1.5.46 for macOS arm64 only. Keep Windows validation non-publishing
  and exclude all Windows artifacts from the v1.5.46 draft and public manifest.
