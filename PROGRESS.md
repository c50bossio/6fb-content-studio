# Progress

Last updated: 2026-07-22

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

### Smart Live Trends release preparation (2026-07-22)

Smart Live Trends merged to `origin/main` as
`fa959f8f1b2366e216f0ada67762018d45912835` through desktop pull request #37.
It is not present in the already public macOS-only `v1.5.46` tag, so the next
possible desktop distribution is a new macOS-arm64-only `v1.5.47` release. The
current release workflow is already Mac-only and stages exactly the four Mac
assets; its manual Windows validator is not part of a tag release. This
preparation does not tag, publish, package, or retire the historical YouTube
key. The next gates are review/merge of the v1.5.47 release notes, exact-main
verification, explicit tag approval, workflow certification, and an
authenticated Mac Smart Trends check.

### Smart Live Trends candidate (2026-07-22)

Smart Live Trends is implemented but **not release-ready** in isolated branch
`codex/smart-live-trends`, based on exact `origin/main` commit
`aacdbff6924b6fe4fc5219c8eeabb6590b8bef8f`. The Video Planner now retrieves
bounded current Google Trends RSS signals on an explicit click, can use an
authorized Instagram professional account when available, and labels connected
Content Planner topics as **Your plan**. A policy-remediated YouTube reference
section is implemented behind current versioned consent and the existing 6FB
sign-in token; it calls only the fixed 6FB backend endpoint, preserves validated
backend order/content, and never enters topic selection or barber-fit scoring.
The unavailable TikTok trend row has been removed. When current signals have no barber relevance,
the picker leads with labelled offline Idea starters rather than pretending a
broad trend is niche evidence.

The blocked user-supplied YouTube-key prototype has been removed. Settings now
keeps 6FB Privacy, 6FB Terms, YouTube Terms, and Google Privacy links accessible,
and disabling discovery or resetting the app clears consent and cached YouTube
references. Unit, type, and static contract proof passes locally. Release still
uses the separately owned `/apps/content/api/studio/youtube-trends` backend
contract, which is implemented and locally verified on isolated branch
`codex/youtube-trends-proxy`. On 2026-07-22, a replacement server-only key was
created in the owning Google Cloud project with an API restriction to
`youtube.googleapis.com`; one bounded read-only `search.list` request returned
HTTP 200, and the encrypted `YOUTUBE_API_KEY` value was replaced in the Vercel
production, preview, and development environments. The historical unrestricted
key remains active until the merged deployment and authenticated end-to-end
proof confirm the cutover, at which point it must be deleted. No deployment was
triggered by the environment update. The linked ready-for-review pull requests
are [desktop #37](https://github.com/c50bossio/6fb-content-studio/pull/37),
[backend #125](https://github.com/c50bossio/6fb-content-generator/pull/125),
and [policy #152](https://github.com/c50bossio/6fb-mentorship-landing/pull/152).
At creation, all three preserve their locally verified heads; their remote
checks are pending. This candidate is not merged, deployed, tagged, packaged,
or released.

Current Mac client proof: TypeScript passes; 55 unit tests pass; static contracts
pass across 72 IPC channels; the production build passes; and the 75-capture
responsive audit at 375/768/1440 reports zero console errors, network errors, or
screen findings. Current backend proof: its script typecheck, 161-file/2,782-test
suite, TypeScript check, scoped lint, production webpack build, and independent
42-test security/contract matrix pass. Filesystem scans find no Google API-key
literals or YouTube/Gemini query-key transports. This proof does not substitute
for replacement-key rotation, deployment, or authenticated staging.

Public release `v1.5.46` is available for macOS arm64 from annotated tag
`v1.5.46`, which resolves to the exact approved tag-target commit
`f81b63b7b9400fb76cd37d399f366b9a3fbb2aed`. Production workflow run
`29950002444` passed all six jobs. Exactly four Mac assets are public; an
independent anonymous DMG download matched its published SHA-256, passed
stapling, strict signature, Gatekeeper, version, and disposable-profile launch
checks. Windows remains unpublished and deferred pending Mac adoption.

The reviewed complete-project audit is merged to `origin/main` at
`5a179c49b181aa401f624825413600209f06d296` through pull request #25.
Functionality, responsive UI, instruction routing, folder-app validators, the
rebuilt macOS pipeline runtime, production build, and isolated Electron IPC all
pass. The full suite and workspace validators also pass in an isolated worktree
on that exact merge commit, whose tree matches the verified pull-request head.
The automated review findings were addressed except for one deliberately
declined 44 px CSS suggestion that conflicts with the acceptance contract; the
final 47-screen matrix has zero target or layout findings. Codex found no major
issue on the final implementation head, and the observer cleared the subsequent
handoff-only change. No tag, deployment, release, social post, or other
production-runtime mutation was made.

The v1.5.46 release preparation and post-merge runtime correction are merged to
`origin/main` at `1ca93cf2abaf6b4be629c5203d8dbee3fc00b69a` through pull
requests #27 and #28. Exact-main unsigned Windows preflight `29940447111`
passed, but the owner subsequently chose macOS arm64 as the only near-term
distribution platform. Windows and its signing cost are deferred until Mac
adoption justifies the additional platform.

The macOS-only release change merged through pull request #30 at release-code
anchor `e1fe4a9d94adb1aa59618a14dfd888257467fe5d`; pull request #31 added only
the verified handoff record before final tag target
`f81b63b7b9400fb76cd37d399f366b9a3fbb2aed`. Draft Azure-signing pull request
#29 was closed without merge. The signed-in Azure tenant showed zero
subscriptions at the decision point, and no Artifact Signing or repository
signing setup occurred. Azure and Windows signing were not used for v1.5.46.

## Release preparation (2026-07-22)

- Completed: drafted the v1.5.46 readiness checklist and publishable release
  notes without claiming tag or publication completion.
- Completed: added early semantic-tag/release-note validation, per-tag release
  concurrency, exact draft-asset verification, staged-DMG smoke, explicit draft
  promotion, and anonymous public-download smoke.
- Completed: removed independent Windows publication. The historical reusable
  preflight proved portability; the current path is manual and non-publishing
  so it cannot join a production tag release.
- Completed: Windows-host run `29937539545` passed on exact code commit
  `95a34de2faf8cf53d42a0318580a79601502fa23`: runtime rebuild, full suite,
  strict source and frozen UTF-8 probes, bundled-runtime validation, v1.5.46
  package, packaged-app launch/system-health smoke, and four-file artifact
  upload all passed.
- Completed: independently downloaded the unexpired Windows Actions artifact;
  all four expected files were non-empty, hashes were recorded, and updater
  metadata matched the installer.
- Completed: the Windows loop found and fixed PowerShell `-p` argument binding,
  the documentation test's missing-ripgrep dependency, and four false-green
  `charmap` negative paths without skipping or weakening a check. The exact
  failed, false-green, cancelled, and clean runs are recorded in
  `delivery/evidence/2026-07-22-v1.5.46-release-prep.md`.
- Completed: local full suite, source and rebuilt frozen UTF-8 probes, dependency
  audit, actionlint, workflow YAML parse, shell syntax, documentation contracts,
  and normal/strict/portable workspace validators all pass on the exact tested
  final coordinator code commit
  `b06b0947fab202eb31099567e9dc32a340bb56eb`. Every release checkout now
  disables persisted credentials, enforced by a complete-count contract. The
  Windows packaging and application/runtime implementation remain those tested
  at `95a34de2faf8cf53d42a0318580a79601502fa23`; only production orchestration is
  now removed and the validator is manual-only.
- Decision: ship macOS arm64 only; retain Windows as a manual, non-publishing
  future validation path. Historical Windows proof remains evidence, not a tag
  or release gate.
- Completed: CodeRabbit identified two valid pre-merge findings. Release copy
  now stays future-facing and the contract test locks the Windows validator to
  exact `--publish never`; the full suite and mutation proof pass on final pull
  request head `c9902ef3e34da4fe143594036a2477d5e31e8051`.
- Completed: merged pull request #30 as
  `e1fe4a9d94adb1aa59618a14dfd888257467fe5d`; the merge tree matches the
  reviewed head exactly.
- Completed: rebuilt the macOS runtime and reran the full suite, dependency
  audit, Actionlint 1.7.12, shell syntax, negative public-manifest probes, and
  normal/strict/portable workspace validation on that exact clean
  `origin/main`. All passed; the dependency audit reported zero vulnerabilities.
- Completed: confirmed the six required Apple/GitHub Actions secret names were
  present without reading values, re-pinned exact live `origin/main`, and
  received explicit owner approval for annotated tag `v1.5.46`.
- Completed: pushed the annotated tag at exact
  `f81b63b7b9400fb76cd37d399f366b9a3fbb2aed`; production run `29950002444`
  passed tag validation, runtime build, full suite, signing, notarization,
  exact draft staging, staged-DMG smoke, publication, anonymous manifest, and
  public-DMG smoke.
- Completed: independently downloaded the public 417,493,620-byte DMG,
  matched SHA-256
  `d1f1b1aad04ba25a70a945b7286f67e4d7da718d100b6cf47fcf860f2b48bde8`,
  passed stapling, strict signature, Gatekeeper, version `1.5.46`, and launched
  the renderer from a disposable profile. Updater metadata hash-matched and
  references only the arm64 ZIP.
- Blocked: no release blocker remains. Windows publication remains a separate
  future decision based on measured Mac adoption.
- Completed and owner-approved through pull request #35: a framework for
  frozen-cohort activation, four-week retained creation, outcome coverage,
  qualified Windows demand, blocker guardrails,
  privacy boundaries, and an aggregate-only scorecard. Current adoption values
  remain not measured; GitHub downloads are distribution context only.
- Decision: open a Windows business/signing review after
  the standard gate (20 verified mature-cohort activations, at least 50%
  activation, at least 80% outcome coverage, at least 10 four-week-eligible
  participants with at least 50% retention, 5 qualified Windows commitments in
  30 days, and clean guardrails) or a weekly 10-commitment direct-demand
  override that is exempt from Mac-cohort maturity. Neither gate would authorize
  a Windows release.
- Blocked for measurement: no owner-controlled pilot roster or weekly check-in
  source is recorded. Unknown adoption values must remain not measured.
- Next: establish the external pilot roster and first reviewed invitations. Do
  not add telemetry, contact customers, or create a Windows release without
  separate approval.

## Last session (2026-07-21)

- Completed: full source discovery and critical-flow map; security, IPC,
  scheduler, editor-render, external-timeout, and profile-isolation repairs;
  repeatable test contracts; and disposable real media-pipeline proof.
- Completed: 47-screen responsive and interaction-state matrix at 375, 768, and
  1440 px with zero layout, target-size, overlay, console, or network findings.
- Completed: folder-app normal/strict/portable validation; 5 positive and 5
  negative trigger tests; documentation/link/command contracts; missing-tool
  failure behavior; and correction of stale `v1.5.45` release truth.
- Completed: fail-closed Remotion prerequisite handling, clean CLI error output,
  macOS runtime rebuild, and bundled-binary verification.
- Completed: parallel adversarial code/proof review and observer oversight;
  closed renderer settings-file disclosure, symlink escape, broad output-folder
  read authorization, invalid re-trim, false-green visual gate, packaged Setup
  asset, Windows native-command masking, and failed-stage CLI exit defects.
- Completed: 10 unit tests, 68 IPC contracts, 31 documentation files, production
  build, isolated Electron IPC smoke, visual-gate negative self-test, and a
  clean 47-screen final matrix with zero layout/console/network findings.
- Completed: pinned exact-file approvals that resist symlink retargeting and are
  revoked immediately by app reset; transactional concurrent trim locking,
  accurate re-encoding, playable-output probing, and metadata rollback; and
  fail-closed Python stage, posting, research, format, and clip-count behavior.
- Completed: ready-for-review follow-up for the Windows populated-venv test
  interpreter, exact trusted App Data folder opening without descendant access,
  and visual-audit rejection of a stale server occupying the configured port.
- Completed: full review follow-up for browser API signature parity, truthful
  awaited publishing handoffs, cross-platform validation, graceful missing-file
  failures, fail-closed pipeline exceptions, canonical-path efficiency, and CDP
  close/error rejection without hanging pending requests.
- Completed: keyboard-safe focus entry, Tab/Shift+Tab containment, Escape close,
  inert background, and opener restoration for navigation and every modal overlay;
  47 responsive captures remain clean with two executable focus contracts.
- Completed: rebuilt the macOS bundled runtime from the repaired Python source,
  then passed the complete serial suite with 10 unit tests, 68 IPC contracts, 14
  required documentation paths, the CDP fault probe, production build, and
  isolated Electron IPC smoke.
- Completed: merged pull request #25 as `5a179c49b181aa401f624825413600209f06d296`,
  confirmed its tree matches the reviewed head, and reran the full suite plus
  normal, strict, and portable workspace validation on that exact merge commit.
- Blocked: no local code or instruction blocker. Independent Windows-host
  execution and a fresh `v1.5.45` installer certification were outside this
  macOS local audit and are not claimed.
- Superseded: that audit session stopped before tagging or publication. The
  current status above records the later approved v1.5.46 release; scheduler
  runs and social posting remain separate and were not performed.

## Decisions made

- Keep the Electron, React, Python, and packaging structure unchanged.
- Use `product`, `engineering`, and `delivery` as the three work modes.
- Keep generated `release/` output separate from the `delivery/` workspace.
- Keep the source manifest's existing versioning behavior: release workflows
  stamp the tag version while packaging instead of committing generated release
  output or a release-only source-version change.
- Treat local unsigned, local signed, workflow-built, and publicly downloadable
  artifacts as separate evidence levels.
- Keep the optional Remotion composition path fail-closed until its separate
  workspace is intentionally installed; the shipping Electron path stays on
  the verified FFmpeg runtime.
- Use project-owned `npm run qa:visual` and workspace-validator commands so
  verification has no undocumented setup steps.
- Keep generated screenshots in ignored `out/qa`; record exact hashes and local
  paths in tracked audit evidence rather than moving generated output into source.
- Permit renderer media reads only from the real app-owned clips tree or exact
  main-process-approved files. Output-directory approval never grants descendant
  read access, and persisted media grants are written only by trusted handlers.
  Legacy external assets saved before canonical approval pinning are never
  silently reapproved and may require one native file-picker re-selection.
- Treat status checks as only one part of the evidence. Current code, full local
  proof, observer clearance, and the exact-head Codex review support the
  merged audit. Four GitHub threads remain administratively open:
  three findings are addressed in code and one 44 px suggestion is deliberately
  declined. Workflow and public-release certification remain separate gates.
- Prioritize Guided Plan-to-Post as the next product cycle. The decision is
  grounded in the current source and release trajectory; no direct barber
  feedback or usage evidence is yet recorded.
- Ship the near-term product for macOS arm64 only. Defer Windows distribution,
  support, and Authenticode signing until Mac adoption supplies evidence for it.
- Use the approved provisional frozen-cohort activation, four-week retention,
  outcome coverage, Windows demand, and blocker guardrails for the Mac pilot.
  Keep Windows reconsideration separate from signing spend and release approval.

## Open questions

- Who owns the non-repository pilot roster and weekly participant check-in?
