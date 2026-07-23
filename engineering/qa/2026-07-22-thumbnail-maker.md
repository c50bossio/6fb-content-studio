# Thumbnail Maker verification

Date: 2026-07-22

## Scope

Local feature branch `codex/thumbnail-maker`, based on `origin/main`
`aacdbff6924b6fe4fc5219c8eeabb6590b8bef8f`.

The feature adds the House Cut transcript-packaging contract to Content Studio:
one diagnosis, exactly three titles, exactly three transcript-grounded thumbnail
concepts, a description, and one CTA. The concepts are intentionally one
warning, one mistake, and one curiosity lane. The page can create a finished
cover from a user-selected app-owned frame through `gpt-image-1.5`; package
generation uses the OpenAI Responses API with `gpt-5.2`, strict structured
output, and response storage disabled. Nothing is published automatically.

## Automated proof

- `npm run typecheck`: passed.
- `npm run test:unit`: 16 passed, including exact-count, distinct creative
  lanes, duplicate, 2-4 word, timestamp, title/thumbnail separation, and
  Markdown-export cases.
- `npm run test:contracts`: passed with 72 preload/main IPC channels and bounded
  OpenAI client enforcement.
- `npm run test:cdp`: passed.
- `npm run test:docs`: passed with 14 required paths and 43 source Markdown files.
- `npm run test:python`: passed using the populated project build venv.
- `npm run test:runtime`: passed for `darwin-arm64`.
- `npm run build`: passed for main, preload, and renderer.
- `npm run test:electron`: passed from an isolated user-data profile.
- `npm run qa:visual:self-test`: passed; occupied port, layout, target-size,
  console, and network defects were rejected.
- `npm run qa:visual`: 53 states captured at 375, 768, and 1440 px; zero layout,
  target-size, console, or network findings; two focus contracts passed.

## Manual visual review

Reviewed `thumbnail-maker-results.png` at all three widths. The source selector,
generation action, diagnosis, title list, concept cards, editable director
controls, copy/export actions, description, and CTA remain coherent without
horizontal overflow. The 375 and 768 px views intentionally continue vertically
below the viewport.

## Evidence boundary

One owner-authorized real-source acceptance call completed after local proof:
the stored Content Studio OpenAI key generated a strict `gpt-5.2` package from
the 19,409-character transcript for `Top 3 Tapers Video FINISHED.mp4` (library
run `1775592631332`). The source package validator accepted one diagnosis,
three titles, and three distinct timestamped thumbnail directions. The call
used no retries and disabled response storage. No key or transcript is recorded
in this note, and no upload, scheduling action, or publication occurred.

This is an API and source-contract acceptance, not a claim that the uninstalled
feature branch has been packaged into the released desktop app. The handler is
also covered by request/response types, bounded retry and timeout contracts,
strict structured output, mocked populated UI proof, production build, and
Electron IPC smoke.

## Finished cover acceptance

One owner-authorized `gpt-image-1.5` image-edit call used the app-owned clip
frame for the `DON'T GET CUTE` concept. The call returned a real 1536×1024 PNG,
saved it under the app-owned `thumbnail-lab/` directory, and the visual review
confirmed the requested headline and barbering action are readable. The first
attempt exposed a local-frame MIME defect (`application/octet-stream`); the
handler now attaches a typed PNG/JPEG file and the corrected request succeeded.
No generated image was uploaded, scheduled, or published.

The quality contract requires the approved comparison composition: a dark,
high-contrast cover, real barbering action on the right, and a clean left-side
field for the exact headline. The renderer offers a sequential three-cover
generation action; it stops after the first failed request rather than issuing
additional image calls.

## Packaged-preview three-cover acceptance

The built feature branch was opened through the actual Electron renderer and
IPC path against the existing local Content Studio profile. The owner-selected
`Top 3 Tapers Video FINISHED.mp4` run `1775592631332` produced a fresh package
with concepts `BOWL CUT?` (00:07:41), `TOO THIN` (00:02:02), and `AT WHAT
COST?` (00:04:52). The renderer then completed all three bounded, sequential
`gpt-image-1.5` calls and rendered the local PNG results. No alert was shown,
and the terminal status confirmed that nothing was uploaded or published.

The first live retry surfaced an invalid overlong timestamp from the structured
package response. The JSON schema now constrains the timestamp field to the
same `MM:SS` or `HH:MM:SS` pattern and maximum length as the server validator.
After that repair, `npm run typecheck`, `npm run test:unit` (15), `npm run
test:contracts` (71), and `npm run build` passed before this successful
renderer acceptance.

## Director-controls quality pass

The approved follow-up keeps the image model focused on the authentic barbering
visual and moves exact headline typography into Content Studio. Each result card
now has editable headline, warning/mistake/curiosity lane, accent, graphic
treatment, and visual-focus controls. Renderer export captures the composed
16:9 PNG at 1536×864 and saves it under the app-owned `thumbnail-lab/` path.

Following this change, `npm run typecheck`, `npm run test:unit` (16), `npm run
test:contracts` (72), `npm run build`, `npm run test:docs`, and `npm run
qa:visual` passed. The 53-screen responsive capture reported zero layout,
target-size, console, or network findings. No live image or export request was
needed for this local UI verification.

## Real three-cover export acceptance

An owner-authorized Electron run against the existing Content Studio profile
selected completed library run `1775592631332` for `Top 3 Tapers Video
FINISHED.mp4`. It made one bounded `gpt-5.2` package request and three bounded,
sequential `gpt-image-1.5` calls. The returned titles and comparison headlines
were `BOWL CUT?`, `TOO THIN`, and `WHY CLOSED FIRST?`; the app reported all
three covers ready without an alert.

The first composed export uncovered a real defect: a responsive card was being
stretched into a 1536×864 output, leaving the thumbnail in the upper-left.
The fix adds a guarded `read-thumbnail-image-data` IPC handler for app-owned
`thumbnail-lab` PNGs and captures a real off-screen 1536×864 composition with
the generated image embedded as a data URL. Typecheck, 16 unit tests, 73 IPC
contracts, and production build passed after the fix. The same app-generated
visuals were then rehydrated locally without another model request and exported
through the renderer. The final verified files are:

- `thumbnail-lab/export-1784770483121/top-3-tapers-video-finished-bowl-cut.png`
- `thumbnail-lab/export-1784770483274/top-3-tapers-video-finished-too-thin.png`
- `thumbnail-lab/export-1784770483433/top-3-tapers-video-finished-why-closed-first.png`

Each is a full-size 1536×864 PNG containing the authentic generated barbering
visual, exact app-rendered headline, and selected graphic treatment. No upload,
scheduling action, publication, commit, merge, package, or release occurred.

## House Cut reference refresh

The local House Cut thumbnail brief and its selected/generated contact sheets
were reviewed before this follow-up. The durable rule carried into the maker is
one claim, one visible proof cue, and one accent system. The packaging prompt
now requires a specific barbering proof cue rather than a generic pose or
collage. The image-edit prompt now forbids AI-rendered typography, arrows,
circles, boxes, diagrams, duplicate cutaways, and unrelated props; the renderer
owns the headline and can add at most one line or marker ring.

The owner-authorized refresh used app-owned frames from the same Top 3 Tapers
library run. Four bounded `gpt-image-1.5` image edits completed locally while
the preview renderer was attached; one extra `BOWL CUT?` output was created
when the preview CDP response closed before reporting the first sequential
request set. The current reviewed source visuals are clean and annotation-free:

- `thumbnail-lab/thumb-1784771397050/bowl-cut.png`
- `thumbnail-lab/thumb-1784771341983/too-thin.png`
- `thumbnail-lab/thumb-1784771401112/why-closed-first.png`

The current final full-size comparison exports are:

- `thumbnail-lab/export-1784771472722/top-3-tapers-video-finished-bowl-cut.png`
- `thumbnail-lab/export-1784771472787/top-3-tapers-video-finished-too-thin.png`
- `thumbnail-lab/export-1784771504154/top-3-tapers-video-finished-why-closed-first.png`

Each was inspected at 1536×864. The `WHY CLOSED FIRST?` option was revised to
three stacked headline lines before export so it stays readable at feed size.
`npm run typecheck`, `npm run test:unit` (16), `npm run build`, and `npm run
test:contracts` (73) passed after the prompt and headline-treatment change.
The final `npm run qa:visual` pass captured 53 states with zero layout,
console, or network findings and two focus contracts. No upload, schedule,
publication, commit, merge, package, or release occurred.

## Editorial photographic refresh

The first House Cut refresh removed model-drawn annotations, but visual review
showed that a hard left black type field and generic system-font overlay still
read as a flat vector card rather than an editorial thumbnail. The source
prompt and renderer were updated accordingly: base art must reject vector
poster, stock-cutout, and flat-render aesthetics; it uses full-bleed
photography, a depth-shaped left foreground instead of a hard split panel,
cinematic grading, subtle grain, and display typography. Default proof marks
were intentionally omitted from this comparison set.

The owner-authorized live refresh used only app-owned frames from the same
`Top 3 Tapers Video FINISHED.mp4` run. Five bounded `gpt-image-1.5` edits were
made while the preview CDP stream twice dropped before reporting an in-flight
result; this left two redundant clean base images for the first two concepts.
The final confirmed bases and local full-size exports are:

- `thumbnail-lab/thumb-1784772284078/bowl-cut.png` →
  `thumbnail-lab/export-1784772592930/top-3-tapers-video-finishedmp4-bowl-cut.png`
- `thumbnail-lab/thumb-1784772323083/too-thin.png` →
  `thumbnail-lab/export-1784772649459/top-3-tapers-video-finishedmp4-too-thin.png`
- `thumbnail-lab/thumb-1784772438674/closed-first.png` →
  `thumbnail-lab/export-1784772663842/top-3-tapers-video-finishedmp4-closed-first.png`

Each export is a guarded app-owned 1536×864 PNG. The final composition was
created in the renderer with the same production cover treatment and saved by
the normal `export-thumbnail-cover` IPC handler; no upload, scheduling,
publication, commit, merge, package, or release occurred. The refreshed source
change passed `npm run typecheck`, 16 unit tests, 73 IPC contracts,
`npm run build`, the final 53-state visual audit with zero findings, and
documentation contracts.

## Thumbnail Library persistence

The maker now saves every completed three-option package as a source-linked,
validated record under the app-owned `thumbnail-packages` directory. The local
library lists saved packages with their finished-cover count, reopens the full
decision set, hydrates app-owned generated PNGs for exact-cover export, and
supports explicit saves after director-control refinements. Saving does not make
another model request.

The Electron IPC smoke used a disposable profile to save, list, and reopen a
complete three-concept package through the real preload/main boundary, then
proved that an attempted reference path outside the app-owned clips directory
fails closed. No OpenAI request, upload, scheduling action, publication,
commit, merge, package, or release occurred. Verification passed: typecheck,
17 unit tests, 76 IPC contracts, documentation contracts, production build,
isolated Electron IPC smoke, and the 53-state responsive visual audit with zero
layout, console, or network findings.

## Current-main integration

The Thumbnail Maker commit was rebased onto current `origin/main` at v1.5.47,
preserving the newer Smart Trends and YouTube-consent implementation. The
combined branch passes typecheck, 62 unit tests, 80 IPC contracts, documentation
contracts, production build, the isolated Electron IPC smoke, and an 81-state
visual audit with zero layout, console, or network findings. It remains local
and unmerged; no model request, upload, scheduling action, publication, or
release occurred during integration verification.
