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

Proposed v1.5.46 release preparation is on
`codex/v1.5.46-release-prep`, based on `origin/main`
`821b1582d45941e74580a162dc6e7a3066116aef`. The preparation replaces
independent platform publication with a coordinated, draft-first release: both
platform jobs must pass, the draft must contain exactly eight non-empty assets,
the staged macOS DMG must pass stapling/signature/Gatekeeper/version checks, and
only then may the release become public. A final anonymous public-DMG smoke is
part of workflow completion. No `v1.5.46` tag, release, public installer, or
updater publication exists yet.

## Release preparation (2026-07-22)

- Completed: drafted the v1.5.46 readiness checklist and publishable release
  notes without claiming tag or publication completion.
- Completed: added early semantic-tag/release-note validation, per-tag release
  concurrency, exact draft-asset verification, staged-DMG smoke, explicit draft
  promotion, and anonymous public-download smoke.
- Completed: converted the Windows workflow to a reusable, non-publishing job
  with a manual pre-tag dry-run path; removed independent Windows publication.
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
  code commit. Independent code review found no actionable defect.
- Blocked for tagging: merge the preparation change, run and record the Windows
  workflow on the exact final main commit, and decide whether v1.5.46 may ship
  with unsigned Windows installers or requires Authenticode signing.
- Next: review and merge the preparation change, re-pin exact `origin/main`, run
  the non-publishing Windows-host preflight, then request separate explicit tag
  approval. Do not tag or publish during preparation.

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

## Open questions

- Will v1.5.46 ship with the current unsigned Windows artifacts, or must
  Authenticode signing and verification be added first?
- Independent public-DMG launch/runtime and downloaded Windows installer and
  portable-app acceptance remain separate certification gates after publication.
