# Progress

Last updated: 2026-07-22

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

Public release `v1.5.45` is available from merged `origin/main` commit
`14be3d825f28f91edfaf18cdaf6d334e545aeeb2`; both platform workflows succeeded
and eight assets are public. The most recent independent public-DMG signature,
launch, and real-Mac workflow certification remains `v1.5.44`.

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

The macOS-only release change is merged through pull request #30 at exact
`origin/main` commit `e1fe4a9d94adb1aa59618a14dfd888257467fe5d`.
Its tree matches final reviewed pull-request head
`c9902ef3e34da4fe143594036a2477d5e31e8051`. The release contract requires
exactly four Mac artifacts, staged-DMG certification before publication, and an
anonymous public-DMG smoke afterward. Draft Azure-signing pull request #29 was
closed without merge. The signed-in Azure tenant showed zero subscriptions at
the decision point, and no Artifact Signing or repository signing setup occurred.
No `v1.5.46` tag, release, public installer, or updater publication exists.

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
- Completed: confirmed the six required Apple/GitHub Actions secret names are
  present without reading their values, and confirmed `v1.5.46` remains unused
  locally and on GitHub.
- Blocked for tagging: at approval time, re-fetch and record exact live
  `origin/main`, confirm it contains verified release-code anchor
  `e1fe4a9d94adb1aa59618a14dfd888257467fe5d` with no later runtime or release
  workflow change, and obtain separate explicit owner approval.
- Next: stop before tagging. After that re-pin and approval, push only the
  approved annotated tag and monitor the Mac-only signing, notarization,
  staged-DMG, publication, and anonymous public-download gates.

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
- Next: stop before tagging, deployment, release publication, scheduler runs,
  or social posting until the owner explicitly approves that separate gate.

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

## Open questions

- What measurable Mac adoption threshold should trigger reconsidering Windows?
- Independent public-DMG launch/runtime remains a separate post-publication
  certification gate.
