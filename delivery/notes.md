# Delivery notes

Last updated: 2026-07-21

## Confirmed facts

- The source `package.json` reports version `1.5.39`; tag workflows stamp the
  release version while packaging.
- `.github/workflows/release.yml` builds, signs, notarizes, and publishes macOS
  artifacts on `v*` tags.
- `.github/workflows/release-windows.yml` builds and publishes Windows installer
  and portable artifacts on `v*` tags.
- Generated package output belongs in ignored `release/`.
- Pull request #18 merged to `main` as
  `9b792a1e9aac312c5599dbff7220e62103e432f5` on 2026-07-21.
- Annotated tag `v1.5.43` resolves to that exact merge commit.
- `v1.5.43` is superseded by `v1.5.44` as the current non-draft,
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

## Open questions

- None for release publication. A native-file-picker interaction in the optional
  real-Mac acceptance flow awaits Apple Events permission for the local
  automation process; it does not affect the completed release workflows.

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
- Keep unsigned local, signed local, workflow-built, and externally published
  artifact claims separate.
- Treat CodeRabbit's post-fix quota failure as an optional external-capacity
  limit, not a code failure; do not weaken required local or post-merge verification.
- Record the absence of an independent Windows-host launch smoke explicitly
  instead of implying that macOS verification exercised Windows binaries.
