# Smart Live Trends verification

Date: 2026-07-22

Status: **Mac policy remediation and authenticated backend implemented and
verified locally; deployment, staging, and release proof remain blocked**; not
pushed, merged, tagged, packaged, or released

The older evidence below records the pre-policy candidate and remains historical,
not release approval. The user-owned key path is now removed. The remediated Mac
client uses the existing 6FB token and fixed backend endpoint, requires persisted
policy-version consent, keeps all four legal links accessible, renders official
branding, preserves validated YouTube fields/order, and isolates references from
topic selection and barber-fit scoring. The backend endpoint passed its separate
local full-suite/security/build proof; an authenticated deployed response is not
claimed by this client proof.

## Authenticated backend proof

The isolated backend branch `codex/youtube-trends-proxy` passed its final clean
loop without a live external request:

```text
npm test
modified import-script typecheck: pass
Vitest: 161 files, 2,782 tests pass

npm run test:ci
161 files, 2,782 tests pass

focused Studio/auth/helper/security matrix
5 files, 42 tests pass

npx tsc --noEmit; scoped ESLint; production webpack build
pass; /api/studio/youtube-trends is present in the build

filesystem credential/transport scans
0 Google API-key literals; 0 YouTube/Gemini query-key transports
```

The independent observer verified Bearer-only authentication, zero upstream
calls without auth or a configured server key, strict response fields and
original order, nullable upstream time, one-hour synchronous plus physical cache
expiry, old-timer race safety, a shared 60-second failure circuit, at most two
bounded upstream attempts, fixed origins, header-only credentials, and rejected
redirects. A previously tracked server key was removed from source, but its
history means the owner must revoke or rotate it before deployment.

## Policy-remediated Mac client proof

The current isolated worktree passed these gates after removing the desktop key
path and adding versioned consent plus the reference-only backend client:

```text
npm run typecheck
TypeScript: pass

npm run test:unit
55 pass, 0 fail

npm run test:contracts
72 IPC channels; contract checks pass

npm run build
Electron main, preload, and renderer production builds: pass

npm run qa:visual
75 captures at 375, 768, and 1440 px
0 console errors; 0 network errors; 0 screens with findings
3 focus contracts pass
```

Focused executable cases prove that missing 6FB sign-in or current consent makes
zero YouTube backend requests, and that 429, 5xx, or network failure makes exactly
one desktop attempt. Parser tests prove whole-response rejection for malformed
URLs/thumbnails while preserving valid result fields and order. The YouTube
contract does not accept, compute, or display a result count. Static
contracts prove the renderer has no `setTopic(reference...)` path and the service
does not pass YouTube results to `rankTrendIdeas`. When upstream freshness is
unknown, `sourceCheckedAt` remains `null`; the client does not replace it with
the required `servedAt` receipt timestamp. The canonical backend request uses
`redirect: 'error'`, so its 6FB bearer token cannot follow a redirect. Public
YouTube cache entries are deleted synchronously at the 24-hour boundary and by
an unref'd race-safe timer; disabling discovery or resetting clears all pending
expiry timers as well as payloads.

Responsive artifacts are in `out/qa/final-proof/`, including
`planner-youtube-references.png`, `settings-youtube-consent-required.png`, and
`settings-youtube-enabled.png` at every required width. The generated report is
`out/qa/final-proof/report.json`.

## Scope and map

The project is a mixed Electron, React/TypeScript, and Python desktop application
for barbers to plan, create, edit, schedule, publish, and measure content. This
change affects the Video Planner renderer, Settings connection UI, typed
preload/IPC boundary, Electron main credential storage/network service, Content
Brain ranking inputs, contracts, and responsive QA harness. It does not change
the Python media pipeline, packaging, or release workflows.

Critical flows:

1. Explicit, bounded retrieval of source-backed current signals.
2. Truthful separation of live, stale cached, personal-plan, and starter ideas.
3. Deterministic barber-fit ranking without rewriting unrelated evidence.
4. Keyboard/touch selection into the existing Video Topic field.
5. Independent graceful degradation for empty, slow, malformed, and failed
   sources.

Missing external prerequisites are explicit: Google Trends API alpha access is
not present, so the current Google path uses the public US RSS feed. Instagram
requires an eligible authorized professional account. The Mac YouTube client
now supplies the legal, consent, brand, and data-isolation surfaces. The
separate 6FB backend contract is locally implemented and verified; deployment
configuration, replacement-key rotation, and authenticated staging proof remain
external prerequisites. No real Instagram or YouTube credential was used in
this verification.

## Functional iterations

The implementation loop found and corrected: fabricated static trend labelling;
stale year copy; plan topics represented as cached/live or reused across a day
boundary; cross-account caches;
uncapped empty-result retries; malformed success payloads treated as empty;
duplicate traffic copy; missing source links; stale results during refresh;
expired Graph API version strings; broad zero-fit signals suppressing useful
starters; ambiguous low-fit source status; an unavailable TikTok row with no
connection path; the absence of official YouTube discovery; and a first-pass
YouTube credential in the request URL rather than the supported header. No test was
deleted, skipped, or weakened.

One click has a hard maximum of 13 external attempts: Google 2, YouTube backend 1,
Content Planner 2, and Instagram 8 across two fixed hashtag lookup/media pairs. Each attempt is
time-bounded, response size is capped, only one transient retry is possible, and
three source failures open a five-minute circuit. Missing connections perform
zero requests.

Pre-policy functional gate (run from the isolated worktree while reusing the primary
checkout's installed `node_modules` and previously verified packaged Python
runtime through temporary read-only symlinks, plus its build venv):

```text
SIXFB_TEST_PYTHON=/Users/bossio/clawd/projects/6fb-content-studio/python/.build-venv/bin/python npm test
TypeScript: pass
Node unit tests: 49 pass, 0 fail
IPC/static contracts: 70 IPC channels plus critical static contracts pass
Documentation contracts: 14 routed paths and 45 Markdown files pass
Python source and failure preflights: pass
Packaged runtime gate: pass
Production renderer/Electron build: pass
Isolated real Electron IPC smoke: pass
```

The installed Node dependencies and packaged runtime were reused read-only from
the primary checkout; neither was rebuilt or modified. Both temporary symlinks
were removed before handoff. Reproducing the exact command in this isolated
worktree therefore requires installing dependencies or temporarily providing
those same local prerequisites again.

## Responsive and interaction proof

The final matrix captures 75 screens and interaction states across 375, 768,
and 1440 px, including live, low-fit, starter, error, loading, hover, focus,
cached-age, YouTube consent-required/enabled/reference, modal, and navigation
states. It reports zero horizontal overflow, clipped text,
targets below 44 px, overlays, console errors, and network errors. Three focus
contracts pass, including actual keyboard selection of a trend result.

```text
npm run qa:visual:self-test
pass: occupied-port rejection, exit 1, 23 injected screen findings,
2 injected console errors, and 1 injected network error were all detected

npm run qa:visual
75 screens; 0 layout/target findings; 0 console errors; 0 network errors;
3 focus contracts pass
```

Final artifacts:

- `out/qa/final-proof/report.json`
- `out/qa/final-proof/375/planner-trends-live.png`
- `out/qa/final-proof/375/planner-trends-cached.png`
- `out/qa/final-proof/375/planner-trends-low-fit.png`
- `out/qa/final-proof/375/planner-trends-focus.png`
- `out/qa/final-proof/375/planner-youtube-references.png`
- `out/qa/final-proof/375/settings-youtube-consent-required.png`
- `out/qa/final-proof/375/settings-youtube-enabled.png`
- `out/qa/final-proof/768/planner-youtube-references.png`
- `out/qa/final-proof/1440/planner-youtube-references.png`

Selected SHA-256 checksums:

```text
b8dcce5d8c7bcda7de511849afab7d1ab3591bd321559fb4999f6749d17e9900  375/planner-trends-live.png
81351f504144eb3aa9592760306d2eef19f9c4fbe0ca6e7be76dd9bd25ea0331  375/planner-trends-cached.png
85e32767907af940108e4cce53debe2ace7fd4f66db1f647cd07ba2cd6958ba4  375/planner-trends-low-fit.png
4096cfc4a2464e79e796302e1e5ec833f7984d5aa0e14a7a6e0bb5f450d43d6c  375/planner-trends-focus.png
cb86d353cb281e3bd82a9e2401d83e94451c7fe370eb2798271af92b62e94441  375/planner-youtube-references.png
d76a18367523143905f734b76ba9b82d64933912f3b604faf5928479c80280b2  375/settings-youtube-consent-required.png
94b333bb67fcf5fcbaeb24296691c10f0d734ff6160e6ecf1c09839ba5aeae8b  375/settings-youtube-enabled.png
e415b3c9f1312700a47adc4e2b188be2c9dc5be9fe330744a35aca9a332cf84b  768/planner-youtube-references.png
d62c9d3fb163bbd90967197db2971988062cebc4f8dedf3ea09bb36bb28f1024  1440/planner-youtube-references.png
```

## Instruction and routing audit

Five requests that should route into this feature and their deterministic route:

1. Define what **Live** means -> `/product`, brief and source decision.
2. Add bounded retrieval to the planner -> `/product` acceptance, then
   `/engineering` implementation.
3. Connect YouTube discovery -> `/product` source decision, then `/engineering`
   Settings and bounded official API adapter.
4. Verify the picker at three widths -> `/engineering` QA evidence.
5. Release Smart Live Trends -> `/delivery`, blocked on an explicit independent
   merge/release approval.

Five actions that must not trigger a live trend request. An executable static
contract locks retrieval to exactly one renderer call site wired to the explicit
**Find live trends** button; the fixture-backed 75-state browser run separately
records zero network errors:

1. Opening Video Planner.
2. Typing a manual topic.
3. Generating or saving a plan.
4. Rendering YouTube's disconnected state.
5. Running responsive browser fixtures.

Normal, strict, and portable workspace validators pass. All referenced project
paths, scripts, and commands resolve. The brief explicitly names missing
prerequisites, external-request limits, failure behavior, and release boundary;
the literal audit requires no unstated product assumption.

## Evidence boundary

Google RSS was checked with bounded read-only spot requests and returned a
current valid feed. Instagram and YouTube behavior is covered by schema,
service, cache, scope, retry, and renderer contract tests only; real Instagram
permissions/live hashtag media and a real authenticated YouTube backend response are not
certified. TikTok was removed from Smart Trends; existing Scheduler platform
support is outside this feature. No publishing, posting, scheduling, customer messaging,
telemetry, production write, or release action occurred.
