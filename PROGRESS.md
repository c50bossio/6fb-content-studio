# Progress

Last updated: 2026-07-21

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

Public release `v1.5.45` is available from merged `origin/main` commit
`14be3d825f28f91edfaf18cdaf6d334e545aeeb2`; both platform workflows succeeded
and eight assets are public. The most recent independent public-DMG signature,
launch, and real-Mac workflow certification remains `v1.5.44`.

The current `codex/complete-project-audit` worktree contains the reviewed
complete-project audit candidate based on `origin/main` commit
`14be3d825f28f91edfaf18cdaf6d334e545aeeb2`. Functionality,
responsive UI, instruction routing, folder-app validators, the rebuilt macOS
pipeline runtime, and isolated production Electron IPC pass locally. The
candidate is committed and pushed in ready-for-review pull request #25. The
first automated review's three actionable findings and 10 of the subsequent 11
CodeRabbit findings are repaired and verified locally. The remaining 44 px CSS
suggestion was deliberately retained because the acceptance contract and clean
all-width screenshots require every visible interaction target to remain at
least 44 px. The final verified implementation follow-up is committed and
pushed at `3a6480b20f5ee62c8083f54c8273dd34da5b14e0`; pull request #25 is open,
ready, and mergeable. CodeRabbit status reports success. The substantive
exact-head Codex review found no major issue. This subsequent handoff-only
update changes no runtime code. No merge, tag, deployment, release, social
post, or other production mutation was made.

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
- Blocked: no local code or instruction blocker. Independent Windows-host
  execution and a fresh `v1.5.45` installer certification were outside this
  macOS local audit and are not claimed.
- Next: finish the status-only handoff check, then merge pull request #25 under
  the owner's explicit `Proceed`; stop before tagging, deployment, or release.

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
  candidate. Four GitHub threads remain administratively open:
  three findings are addressed in code and one 44 px suggestion is deliberately
  declined. Merge, workflow, and public-release certification remain separate
  gates.
- Prioritize Guided Plan-to-Post as the next product cycle. The decision is
  grounded in the current source and release trajectory; no direct barber
  feedback or usage evidence is yet recorded.

## Open questions

- None for local implementation. Merge, tagging, deployment, release, and fresh
  Windows/public-installer certification remain explicit later gates.
