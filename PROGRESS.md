# Progress

Last updated: 2026-07-23

> This file records current cross-workspace state. Durable product,
> engineering, and delivery truth belongs in the corresponding `notes.md`.

## Current status

### Settings UX release candidate (2026-07-23, merged; not yet tagged or released)

`codex/settings-ux-rework` reorganizes Settings around the user workflow:
6FB account, Content Planner, Instagram, and YouTube inspiration appear before
technical controls. API keys, runtime health, storage, version diagnostics, and
Reset App remain available behind an accessible Advanced control; browser SSO
and password fallback behavior are unchanged. The candidate passed the full
suite with 65 unit tests, 82 IPC contracts, Python/runtime checks, production
build, and isolated Electron smoke. Its responsive visual matrix captured 87
states at 375/768/1440 with zero layout, console, or network findings; the
visual gate self-test also passed. It merged through pull request #50 as exact
`origin/main` commit `16cde66ba23218b5e0b22a106ae4ae49cd9cc90c`; the merge
tree passed a fresh full suite, 87-state visual matrix, and strict workspace
validation. CodeRabbit's post-merge check succeeded. No v1.5.50 tag, package,
draft, or public release exists yet.

### Thumbnail Maker release preparation (2026-07-22)

Thumbnail Maker merged to `origin/main` through pull request #40 as
`8e42109eedba1b4eef214f55846a2a2479fc512e`; its exact tree matches the fully
verified pull-request head. No GitHub Actions run was triggered by that merge.
The merged feature adds a persistent local Thumbnail Library plus three
transcript-grounded, editable thumbnail directions with app-owned final exports.
The local integration proof includes TypeScript, 62 unit tests, 80 IPC
contracts, documentation contracts, a production build, an isolated Electron
IPC persistence smoke, and an 81-state responsive visual audit with zero
reported findings. The release candidate is macOS arm64 only. Public v1.5.46
does not contain this feature; private v1.5.47 predates it and remains a Smart
Live Trends draft. v1.5.48 is now a certified private macOS draft from exact
tag target `8e29d4c8ffc20ef5b0e78c1d31b8dce8655c927b`: its constrained runtime
rebuild, full suite, signing, notarization, stapling, exact-four-file manifest,
and staged-DMG smoke passed in workflow `29976055852`. The owner then approved
promotion: v1.5.48 is public and latest for macOS arm64. Workflow `29976866850`
revalidated the draft, promoted it, and passed anonymous public-manifest and
public-DMG smoke checks. Windows remains deliberately unpublished.

The initial clean v1.5.48 pre-tag runtime rebuild caught dependency drift before
any tag was created: PyInstaller 6.21 could not thin its already arm64
bootloader, and the newly resolved SciPy runtime failed in the frozen probe. A
small candidate correction locks the verified macOS-arm64 Python inputs and
enforces them through the runtime builder and static contract. Its fresh
runtime build, full 62-test suite, 80 contracts, production build, Electron IPC
smoke, workspace validators, and workflow Actionlint pass. The correction is
merged and the resulting tagged private draft completed its workflow gates.

### Smart Live Trends release preparation (2026-07-22)

Smart Live Trends merged to `origin/main` as
`fa959f8f1b2366e216f0ada67762018d45912835` through desktop pull request #37.
It is not present in the already public macOS-only `v1.5.46` tag, so the next
possible desktop distribution is a new macOS-arm64-only `v1.5.47` release. The
current release workflow is already Mac-only and stages exactly the four Mac
assets; its manual Windows validator is not part of a tag release. This
v1.5.47 preparation merged through pull request #38 as exact `origin/main`
commit `293037de905edf37296255cb56ce47c1160e9027`; its tree exactly matches the
fully verified pull-request head. This preparation does not tag, publish,
package, or retire the historical YouTube key. The next gates are exact tag
preflight, explicit approval to create the private draft tag, workflow
certification, and an authenticated Mac Smart Trends check before any separate
public-promotion approval.

### Smart Live Trends pre-merge record (historical; superseded)

The following record captures the pre-merge candidate state in isolated branch
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
checks were pending. This historical candidate record is superseded by the
merged desktop/backend/policy state and the v1.5.47 preparation above; do not
use it as current release routing.

Current Mac client proof: TypeScript passes; 55 unit tests pass; static contracts
pass across 72 IPC channels; the production build passes; and the 75-capture
responsive audit at 375/768/1440 reports zero console errors, network errors, or
screen findings. Current backend proof: its script typecheck, 161-file/2,782-test
suite, TypeScript check, scoped lint, production webpack build, and independent
42-test security/contract matrix pass. Filesystem scans find no Google API-key
literals or YouTube/Gemini query-key transports. This proof does not substitute
for replacement-key rotation, deployment, or authenticated staging.
Thumbnail Maker quality improvements remain isolated on
`codex/thumbnail-maker`; they are not merged, packaged, or released. The
feature now assigns three deliberate creative lanes (warning, mistake, and
curiosity), keeps the image model focused on barbering visuals without AI text,
and lets the renderer own editable exact headline, accent, graphic treatment,
and visual-proof-cue controls. It now applies the House Cut reference standard:
one claim, one visible proof cue, and one accent system. The image model is
forbidden from adding text, arrows, rings, diagrams, or extra cutaways; the
renderer owns the headline and at most one proof annotation. Each finished
visual can be exported as a composed 1536×864 PNG from app-owned storage. A
real Electron acceptance run selected the Top 3 Tapers library video, made one
bounded package request and initial three sequential bounded image calls, and
exported three full-size final PNGs. The House Cut follow-up produced reviewed,
clean base art and refreshed three 1536×864 final exports; one extra BOWL CUT?
image edit occurred when the preview CDP response closed before reporting a
sequential result. It exposed and corrected a real card-scaling export defect;
the final outputs and evidence are recorded in
`engineering/qa/2026-07-22-thumbnail-maker.md`. Typecheck, 16 unit tests, 73
IPC contracts, production build, documentation contracts, and the latest
53-state responsive visual audit pass; no upload, schedule, publication,
commit, merge, package, or release occurred.

The latest editorial refresh replaces the remaining hard black type-pane and
flat vector-card feel with full-bleed photography, depth-aware left foreground
headlines, cinematic grading, subtle grain, and restrained display type. The
prompt now rejects vector-poster, stock-cutout, and flat-render aesthetics.
The owner-authorized local three-cover comparison is `BOWL CUT?`, `TOO THIN`,
and `CLOSED FIRST?`; exact app-owned paths and the bounded-request evidence are
recorded in `engineering/qa/2026-07-22-thumbnail-maker.md`. Typecheck, 16 unit
tests, 73 IPC contracts, production build, documentation contracts, and the
53-state visual audit remain green. Two preview-CDP response drops created
redundant local base art during the live refresh; no retry loop remains active
and no upload, schedule, publication, commit, merge, package, or release
occurred.

The same isolated branch now includes a local Thumbnail Library. Each completed
three-option package is saved as a validated, source-linked app-data record and
can be reopened, refined, and saved without another model request. A disposable
Electron IPC smoke proved save/list/load behavior and rejected an outside-owned
reference path. The verified commit is rebased onto current `origin/main`
`0e5600d7855262e3d42cc671ac33f427822506ad` (v1.5.47), retaining the newer
Smart Trends and YouTube-consent work. The integration proof passes typecheck,
62 unit tests, 80 IPC contracts, documentation contracts, production build, the
isolated Electron IPC smoke, and the 81-state visual audit with zero findings.
This remains unmerged and unreleased; no upload, schedule, publication, merge,
package, or release occurred.

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

## Thumbnail Maker development (2026-07-22)

- Completed locally on isolated branch `codex/thumbnail-maker`: added a
  transcript-grounded Thumbnail Maker page, sidebar/dashboard routing, strict
  output validation, bounded OpenAI IPC, local frame matching, copy, and
  Markdown export. The handler uses `gpt-5.2` structured output with response
  storage disabled; existing Claude-backed tools are unchanged.
- Completed: exact House Cut parity for one diagnosis, three titles, three
  distinct 2-4 word thumbnail concepts with transcript evidence and timestamps,
  description, one CTA, and user-initiated finished-cover generation from an
  app-owned frame. The page offers both per-concept cover generation and a
  bounded sequential three-cover comparison set; publishing remains out of
  scope.
- Completed: revised finished-cover art direction to match the owner-approved
  comparison style: dark charcoal contrast, headline field on the left, and
  authentic barbering action on the right. The image contract rejects the
  earlier washed, centered treatment.
- Verified: full local suite passed with 15 unit tests, 71 IPC contracts,
  Python/runtime checks, production build, and isolated Electron IPC smoke.
  The visual gate captured 53 states across 375, 768, and 1440 px with zero
  layout, target-size, console, or network findings.
- Completed: one owner-authorized stored-key OpenAI source-contract acceptance
  call against the 19,409-character `Top 3 Tapers Video FINISHED.mp4` library
  transcript completed with `gpt-5.2` and passed strict output validation.
  Response storage was disabled; no upload, scheduling action, or publication
  occurred. The uninstalled feature branch still needs a local packaged-app
  acceptance run before a release decision.
- Completed: one owner-authorized `gpt-image-1.5` image-edit acceptance call
  generated and visually verified a finished 1536×1024 `DON'T GET CUTE` cover
  from an app-owned clip frame. The generated PNG remains only in app-owned
  local storage; it was not uploaded, scheduled, or published.
- Completed: built-preview renderer acceptance selected the `Top 3 Tapers Video
  FINISHED.mp4` library run `1775592631332`, produced a fresh valid package,
  and generated all three finished local covers (`BOWL CUT?`, `TOO THIN`, and
  `AT WHAT COST?`) sequentially through the real renderer/IPC path. A live
  timestamp-schema gap was corrected by constraining JSON output to `MM:SS` or
  `HH:MM:SS` before post-response validation; typecheck, 15 unit tests, 71 IPC
  contracts, and the production build passed afterward. No upload, scheduling,
  publication, installation, or release occurred.
- Blocked: no local implementation blocker. The branch is not committed,
  pushed, merged, tagged, packaged, or released.
- Next: local packaged-preview acceptance through the actual renderer/IPC path,
  then a separate decision on commit/PR/merge.

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

## Browser-to-desktop SSO handoff (2026-07-22)

- Companion Content Playbook [#126](https://github.com/c50bossio/6fb-content-generator/pull/126)
  merged at `89af986bb55ab2abf61e0abe6dba6fa307316105`, including the
  `8f0ca0221a43b8d3be279a4e9dc9fe4eb75e9000` PKCE-binding repair. Exact-main
  CI is fully green (Build, unit, Playwright, Vercel deploy, and production
  smoke), and GitHub deployment `5566352121` is SHA-bound to that commit.
  A real authenticated browser-to-desktop handoff exposed a production HTTP 500
  at the authorize route before its localhost callback. The deployed workflow
  runs `prisma generate` but no production migration command, while this route
  writes the newly added nullable `OAuthNonce.codeChallenge` column. Owner
  approval was obtained and migration `20260723030000_add_oauth_nonce_code_challenge`
  applied successfully; Prisma then reported the production schema up to date.
  Follow-up [#127](https://github.com/c50bossio/6fb-content-generator/pull/127)
  added a migration-before-deploy gate. Its first exact-main run exposed a
  test-environment precedence defect before deployment; [#128](https://github.com/c50bossio/6fb-content-generator/pull/128)
  corrected that command and merged at `b28204042066062b3000cc59783c81c28d92368a`.
  Exact-main CI `29978261036` then passed Build, unit, Playwright, production
  migration (no pending migrations), Vercel deployment, and a SHA-bound
  production smoke (12 passed, 0 failed).
  A fresh temporary-profile browser handoff reached localhost and returned a
  connected Electron account result without exposing the token to the renderer.
  Desktop [#41](https://github.com/c50bossio/6fb-content-studio/pull/41)
  merged at `bb497c09d46fa49f5b0b69ce60cde03790d8639e`. Its merge tree exactly
  matches the release-tested PR head `4b829fcbc565362d9c6f0308c74368ae647ef53a`.
  It is now publicly shipped in macOS-arm64-only `v1.5.49`, tagged at
  `6ac879942caf19a691338fd28a4f44a5552c7f3b`. Build-and-stage workflow
  `29979429561` and owner-approved publication workflow `29980081756` both
  passed, including notarization, staged/public DMG smoke, and the exact
  four-file public manifest. Windows remains unpublished.
- Desktop: Settings now offers **Sign in with 6FB in browser** while preserving
  password login as a fallback. Electron reserves a random high localhost port,
  creates PKCE/state values in memory, validates the localhost callback, and
  exchanges only an opaque single-use code over HTTPS. Tokens and cookies are
  never placed in URLs or sent to the renderer.
- Content Playbook: its new authorize route uses the existing Hub SSO redirect
  when needed, stores the authorization-time PKCE challenge with a five-minute
  `OAuthNonce`, and redirects to localhost with only an opaque nonce. Its token
  route verifies the submitted verifier against that stored challenge and
  atomically consumes the nonce before returning the scoped Content token to
  Electron.
- Verified: desktop `npm test` passed with the freshly built macOS arm64 Python
  runtime (58 unit tests, 74 IPC/contracts, docs, CDP, Python/runtime, build,
  and isolated Electron smoke); Content Playbook full test suite passed 162
  files / 2,788 tests before the PKCE repair; the repaired head passed the full
  suite, TypeScript, Prisma schema validation, production build, and 9 focused
  SSO tests including substitution, replay, expiry, and race-loss cases.
  Responsive visual audit passed 78 captured states at 375, 768, and 1440 px
  with zero overflow, clipped text, undersized targets, console errors, or
  network errors. The new Settings browser-login state is explicitly captured
  and checked at all three widths.
- Verified after rebasing desktop #41 onto Studio main `ae5270a`: the full
  release-selected suite passed (65 unit tests, 82 IPC contracts, CDP, docs,
  Python/runtime, production build, and isolated Electron smoke). The refreshed
  visual matrix captured 84 states at 375, 768, and 1440 px with zero layout,
  console, or network findings and three focus contracts. The 1440 Settings
  browser-login capture remains clean.
- Next gate: optional real-user Mac acceptance and adoption measurement. No
  Windows release is planned before Mac adoption supports that decision.
