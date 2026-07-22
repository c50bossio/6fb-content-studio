# Smart Live Trends verification

Date: 2026-07-22

Status: local candidate verified; not merged, pushed, tagged, packaged, or
released

## Scope and map

The project is a mixed Electron, React/TypeScript, and Python desktop application
for barbers to plan, create, edit, schedule, publish, and measure content. This
change affects the Video Planner renderer, typed preload/IPC boundary, Electron
main network service, Content Brain ranking inputs, contracts, and responsive QA
harness. It does not change the Python media pipeline, packaging, or release
workflows.

Critical flows:

1. Explicit, bounded retrieval of source-backed current signals.
2. Truthful separation of live, stale cached, personal-plan, and starter ideas.
3. Deterministic barber-fit ranking without rewriting unrelated evidence.
4. Keyboard/touch selection into the existing Video Topic field.
5. Independent graceful degradation for empty, slow, malformed, and failed
   sources.

Missing external prerequisites are explicit: Google Trends API alpha access and
an approved TikTok commercial trend feed are not present. The current Google
path uses the public US RSS feed. Instagram requires an eligible, authorized
professional account; no real account was used in this verification.

## Functional iterations

The implementation loop found and corrected: fabricated static trend labelling;
stale year copy; plan topics represented as cached/live or reused across a day
boundary; cross-account caches;
uncapped empty-result retries; malformed success payloads treated as empty;
duplicate traffic copy; missing source links; stale results during refresh;
expired Graph API version strings; broad zero-fit signals suppressing useful
starters; and ambiguous low-fit source status. No test was deleted, skipped, or
weakened.

One click has a hard maximum of 12 external attempts: Google 2, Content Planner
2, and Instagram 8 across two fixed hashtag lookup/media pairs. Each attempt is
time-bounded, response size is capped, only one transient retry is possible, and
three source failures open a five-minute circuit. Missing connections and the
TikTok unavailable state perform zero requests.

Final functional gate (run from the isolated worktree while reusing the primary
checkout's installed `node_modules` and previously verified packaged Python
runtime through temporary read-only symlinks, plus its build venv):

```text
SIXFB_TEST_PYTHON=/Users/bossio/clawd/projects/6fb-content-studio/python/.build-venv/bin/python npm test
TypeScript: pass
Node unit tests: 44 pass, 0 fail
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

The final matrix captures 66 screens and interaction states across 375, 768,
and 1440 px, including live, low-fit, starter, error, loading, hover, focus,
cached-age, modal, and navigation states. It reports zero horizontal overflow, clipped text,
targets below 44 px, overlays, console errors, and network errors. Three focus
contracts pass, including actual keyboard selection of a trend result.

```text
npm run qa:visual:self-test
pass: occupied-port rejection, exit 1, 21 injected screen findings,
2 injected console errors, and 1 injected network error were all detected

npm run qa:visual
66 screens; 0 layout/target findings; 0 console errors; 0 network errors;
3 focus contracts pass
```

Final artifacts:

- `out/qa/final-proof/report.json`
- `out/qa/final-proof/375/planner-trends-live.png`
- `out/qa/final-proof/375/planner-trends-cached.png`
- `out/qa/final-proof/375/planner-trends-low-fit.png`
- `out/qa/final-proof/375/planner-trends-focus.png`
- `out/qa/final-proof/768/planner-trends-live.png`
- `out/qa/final-proof/1440/planner-trends-live.png`

Selected SHA-256 checksums:

```text
b31967dfaa35162137b8fdf1663c659c2824a3b25e951023ef5d2ac2f41e9be5  375/planner-trends-live.png
a83a421981ef1ddbd9333dfa21472501196901721e1bb3e489bcea4fda07072f  375/planner-trends-cached.png
7838e6910d635abcdf6f0234e0755956e42cd353669663213a1a9f26265ad9e4  375/planner-trends-low-fit.png
ddd8b194a2ae173aa10f2a9c51837bde3191240c3c9e2d5b9ebb64b4fc79cea4  375/planner-trends-focus.png
4a895ecd16306db964db24b4ddaa7c7308274f5a2e6f8f31dc216fcfbadb5ddd  768/planner-trends-live.png
f9d8b2fd55c77b29792ad2bf6224f434fb8fa69d2a3849889e2243c79c575469  1440/planner-trends-live.png
```

## Instruction and routing audit

Five requests that should route into this feature and their deterministic route:

1. Define what **Live** means -> `/product`, brief and source decision.
2. Add bounded retrieval to the planner -> `/product` acceptance, then
   `/engineering` implementation.
3. Scrape TikTok pages for trends -> `/product` source decision; reject the
   unapproved route and retain unavailable status.
4. Verify the picker at three widths -> `/engineering` QA evidence.
5. Release Smart Live Trends -> `/delivery`, blocked on an explicit independent
   merge/release approval.

Five actions that must not trigger a live trend request. An executable static
contract locks retrieval to exactly one renderer call site wired to the explicit
**Find live trends** button; the fixture-backed 66-state browser run separately
records zero network errors:

1. Opening Video Planner.
2. Typing a manual topic.
3. Generating or saving a plan.
4. Rendering TikTok's unavailable state.
5. Running responsive browser fixtures.

Normal, strict, and portable workspace validators pass. All referenced project
paths, scripts, and commands resolve. The brief explicitly names missing
prerequisites, external-request limits, failure behavior, and release boundary;
the literal audit requires no unstated product assumption.

## Evidence boundary

Google RSS was checked with bounded read-only spot requests and returned a
current valid feed. Instagram behavior is covered by schema, service, cache,
scope, retry, and renderer contract tests only; real account permissions and
live hashtag media are not certified. TikTok is intentionally unavailable and
was never called. No publishing, posting, scheduling, customer messaging,
telemetry, production write, or release action occurred.
