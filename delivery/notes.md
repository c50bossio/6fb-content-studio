# Delivery notes

Last updated: 2026-07-22

## Confirmed facts

- Thumbnail Maker merged to `origin/main` through pull request #40 as
  `8e42109eedba1b4eef214f55846a2a2479fc512e`, after tag `v1.5.47` was created.
  The current public download remains v1.5.46; v1.5.47 is a private Smart Live
  Trends draft and must not be promoted as a Thumbnail Maker release.
- `delivery/release-notes/v1.5.48.md` and
  `delivery/checklists/v1.5.48-release-readiness.md` define the next
  macOS-arm64-only candidate. They do not create a tag or publish a release.

- Smart Live Trends merged to `origin/main` through pull request #37 as
  `fa959f8f1b2366e216f0ada67762018d45912835`, after public `v1.5.46` was
  tagged. A new `v1.5.47` tag is therefore required to distribute it.
- `delivery/release-notes/v1.5.47.md` and
  `delivery/checklists/v1.5.47-release-readiness.md` define the Mac-arm64-only
  candidate. They do not authorize a tag or publication.
- v1.5.47 release preparation merged through pull request #38 as exact
  `origin/main` commit `293037de905edf37296255cb56ce47c1160e9027`. Its tree
  exactly matches verified pull-request head
  `82c98941f8f84e9d592a29e4675d8d3519af531b`; no tag or draft release exists.
- The source `package.json` reports version `1.5.39`; the tag workflow stamps
  the release version while packaging.
- `.github/workflows/release.yml` coordinates macOS-arm64-only `v*` releases:
  it stages exactly four Mac assets in a private draft and smoke-checks the
  notarized DMG from that draft. `.github/workflows/publish-release.yml` is a
  separate explicit manual promotion that re-verifies the draft manifest, then
  publishes and performs anonymous public-asset and DMG smokes.
- `.github/workflows/release-windows.yml` is a manual, non-publishing future
  Windows build/test/package validator. It is not callable from the production
  tag workflow.
- Generated package output belongs in ignored `release/`.
- Pull request #18 merged to `main` as
  `9b792a1e9aac312c5599dbff7220e62103e432f5` on 2026-07-21.
- Annotated tag `v1.5.43` resolves to that exact merge commit.
- `v1.5.43`, `v1.5.44`, and `v1.5.45` are superseded by `v1.5.46` as the current
  non-draft, non-prerelease public release.
- For v1.5.43, the macOS and Windows release workflows both completed
  successfully on the exact tagged commit and published all eight expected assets.
- Independent v1.5.43 public-download certification verified the DMG and updater ZIP
  checksums, updater metadata, notarization stapling, strict code signature,
  Gatekeeper acceptance, application identity, embedded runtime, FFmpeg,
  FFprobe, and MLX Metal library.
- Independent Windows-host execution was not part of the v1.5.43 macOS
  closeout. That historical Windows claim is limited to successful workflow
  execution, published assets, and public checksum evidence.
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
- This audit did not independently download the 417 MB `v1.5.45` DMG. The most
  recent independent DMG launch/signature certification is now `v1.5.46`.
- Historical `v1.5.46` preparation baseline is exact `origin/main` commit
  `1ca93cf2abaf6b4be629c5203d8dbee3fc00b69a`, which includes pull requests #25
  through #28. Pull request #30 merged the macOS-only change as exact
  `origin/main` commit `e1fe4a9d94adb1aa59618a14dfd888257467fe5d`.
  Its tree matches final reviewed head
  `c9902ef3e34da4fe143594036a2477d5e31e8051`; this is the verified release-code
  anchor. The exact tag target was then resolved from live `origin/main` as
  `f81b63b7b9400fb76cd37d399f366b9a3fbb2aed`; later changes before tagging
  were limited to the reviewed handoff documents.
- `delivery/checklists/v1.5.46-release-readiness.md` and
  `delivery/release-notes/v1.5.46.md` define the release candidate gates and
  public copy. The checklist now records completed tag and publication gates.
- v1.5.46 is public for macOS arm64 only. Coordinated run `29950002444` passed
  all six jobs and published exactly four Mac artifacts after staged-DMG
  stapling, signature, Gatekeeper, and version checks. The tracked release-note
  file is the public release body.
- Annotated tag `v1.5.46` resolves to exact approved commit
  `f81b63b7b9400fb76cd37d399f366b9a3fbb2aed`. The public release was published
  at 2026-07-22 19:29:54 UTC. Independent anonymous download certification
  matched the DMG and updater-metadata digests, passed notarization stapling,
  strict app signature, Gatekeeper, version, and disposable-profile launch.
- Non-publishing Windows run `29937539545` is the first clean semantic preflight and passed on
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
- Exact merged main `e1fe4a9d94adb1aa59618a14dfd888257467fe5d`
  passed a fresh macOS runtime rebuild, full suite, zero-vulnerability audit,
  Actionlint 1.7.12, shell syntax, exact-four-asset and negative mutation probes,
  and normal/strict/portable workspace validation in a clean detached worktree.
  The six required workflow secret names were present without reading values.
  No main-branch workflow ran for the merge, so this exact-main local proof was
  the pre-tag certification source before the successful production tag run.
- Public asset sizes and SHA-256 digests are recorded in
  `delivery/evidence/2026-07-22-v1.5.46-public-release.md`. No Windows asset or
  general `latest.yml` is present; `latest-mac.yml` points only to the arm64 ZIP.

## Open questions

- Will exact `origin/main` commit `293037de905edf37296255cb56ce47c1160e9027`
  still be the approved `v1.5.47` tag target after the final pre-tag check?
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
