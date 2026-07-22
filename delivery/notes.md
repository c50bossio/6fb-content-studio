# Delivery notes

Last updated: 2026-07-22

## Confirmed facts

- The source `package.json` reports version `1.5.39`; tag workflows stamp the
  release version while packaging.
- `.github/workflows/release.yml` coordinates `v*` releases: it builds and
  validates both platforms, stages all eight assets in a draft, smoke-checks
  the notarized macOS DMG from that draft, and only then publishes.
- `.github/workflows/release-windows.yml` is a reusable, non-publishing Windows
  build/test/package workflow. On the signing candidate, its manual entry point
  performs paid Azure signing and is not a side-effect-free dry run.
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
- Proposed `v1.5.46` preparation is based on audited `origin/main` commit
  `821b1582d45941e74580a162dc6e7a3066116aef`, which includes pull requests #25
  and #26. The final tag target must be the exact verified `origin/main` commit
  after the preparation change is reviewed and merged.
- `delivery/checklists/v1.5.46-release-readiness.md` and
  `delivery/release-notes/v1.5.46.md` define the release candidate gates and
  draft copy. They do not authorize or claim a tag or publication.
- v1.5.46 preparation removes independent platform publication: the coordinated
  workflow can make the release public only after both artifact sets exist and
  the staged macOS DMG passes stapling, signature, Gatekeeper, and version
  checks. The tracked release-note file is the public release body.
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
  shell, and workspace checks pass. The post-Windows delta is limited to this
  coordinator hardening and its contract; the reusable Windows workflow and
  application/runtime code remain those tested in run `29937539545`.
- Pull requests #27 and #28 are merged. Exact `origin/main`
  `1ca93cf2abaf6b4be629c5203d8dbee3fc00b69a` passed local certification and
  unsigned Windows preflight run `29940447111`.
- No exportable Authenticode PFX is available. Candidate branch
  `codex/v1.5.46-windows-signing` therefore uses Azure Artifact Signing with
  GitHub OIDC and no client secret or certificate file.
- The candidate signs each Windows EXE selected by electron-builder's lifecycle and
  immediately requires a valid Authenticode signature, trusted RFC3161
  timestamp, code-signing EKU, and the exact issued publisher DN. Final,
  staged-draft, and anonymous-public checks also bind the installer, portable
  app, blockmap, and `latest.yml` to the exact signed-build hashes.
- The signing candidate has not been exercised against Azure. GitHub currently
  has no `windows-signing` environment or Azure variables, and this host has no
  authenticated Azure inventory. Do not dispatch: GitHub can auto-create a
  missing environment without the intended owner protections.

## Open questions

- What exact post-preparation `origin/main` commit will be approved as the
  `v1.5.46` tag target?
- Will v1.5.46 receive an independent Windows-host installer and portable-app
  launch certification in addition to the Windows workflow smoke?
- Will the owner approve paid Azure Artifact Signing setup and complete portal
  identity validation? Until then, no signed Windows artifact can be claimed.

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
- Keep unsigned local, signed local, workflow-built, and externally published
  artifact claims separate.
- Use OIDC with a protected `windows-signing` environment; do not introduce an
  exportable certificate or `AZURE_CLIENT_SECRET`. Bind the Entra federated
  credential to `repo:c50bossio/6fb-content-studio:environment:windows-signing`
  and grant only Certificate Profile Signer at the profile scope.
- Treat CodeRabbit's post-fix quota failure as an optional external-capacity
  limit, not a code failure; do not weaken required local or post-merge verification.
- Record the absence of an independent Windows-host launch smoke explicitly
  instead of implying that macOS verification exercised Windows binaries.
