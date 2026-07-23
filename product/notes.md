# Product notes

Last updated: 2026-07-22

## Confirmed facts

- The product is a desktop content studio for barbers.
- Current visible surfaces include Dashboard, Brand & Brain, Video Planner,
  Clips, Carousel, Blog Writer, Video Editor, Scheduler, Analytics, and Settings.
- Public release `v1.5.46` is available for macOS arm64 only. Windows
  distribution is deferred pending evidence of Mac adoption.
- The source `package.json` remains at `1.5.39`; the existing tag workflow
  stamps the release version during packaging. The independently downloaded
  public `v1.5.46` app reports version `1.5.46` and passed
  notarization, signature, Gatekeeper, and disposable-profile launch checks.

## Open questions

- Which workflows have recent direct barber feedback or usage evidence?
- Who owns the non-repository pilot roster and weekly participant check-in?

## Recent decisions

- Use this workspace for product intent and acceptance criteria, not runtime source.
- Start the next cycle with one evidence-backed barber workflow and the smallest
  testable brief rather than an unranked feature list.
- Prioritize Guided Plan-to-Post: preserve a saved plan and chosen media through
  Clips, optional editing, and an explicit local scheduling draft. This is a
  source-backed decision pending direct barber feedback.
- Guided Plan-to-Post is now shipped in `v1.5.44`; the published macOS app
  visibly completed its local-fallback Plan-to-Clips handoff without creating
  content externally or posting to a social platform.
- `v1.5.45` applied encoded local-media URLs across clip, carousel, blog,
  brand, scheduler, and editor previews; `v1.5.46` now supersedes it.
- Ship v1.5.46 and the near-term product as macOS arm64 only. Defer Windows
  distribution and code-signing spend until Mac adoption provides evidence that
  the additional platform is justified. Preserve Windows build validation as a
  non-publishing future path; do not publish Windows assets now.

- Measure Mac adoption through a frozen invitation cohort, verified activation,
  four-week retained creation, outcome coverage, and blocker guardrails rather
  than GitHub downloads. The approved standard Windows-review trigger requires
  20 verified mature-cohort activations, at least 50% activation, at least 80%
  outcome coverage, at least 10 four-week-eligible participants with at least 50%
  retention, 5 qualified Windows commitments in 30 days, and clean support
  guardrails. A 10-commitment direct-demand override may open the review early.
  Neither gate authorizes automatic release.
- Smart Live Trends is implemented on an isolated feature branch with explicit
  live, cached, planned, and starter evidence states. Google Trends public RSS,
  an authorized Instagram professional account, and the connected 6FB plan are
  the currently viable source paths. TikTok has no approved source and must not
  appear. The failed user-owned YouTube-key prototype has been replaced by a
  current-version consent gate and authenticated 6FB backend client. YouTube
  references retain backend order/content and stay outside topic selection,
  generation, scoring, and ranking. Backend and staging proof remain separate.
- Thumbnail Maker is built and locally verified on `codex/thumbnail-maker`, but
  is not merged or released. It reproduces the recent House Cut transcript
  packaging contract: one diagnosis, exactly three titles, exactly three
  transcript-grounded 2-4 word thumbnail concepts, description, and one CTA.
  It reuses completed Clip Extractor runs and generates a finished 16:9 cover
  from an app-owned frame only when the user selects a concept. Publishing stays
  outside this scope. Thumbnail packaging uses OpenAI `gpt-5.2` and finished
  cover generation uses `gpt-image-1.5`; the app's existing Claude-backed clip,
  carousel, and blog tools are unchanged.
- Finished covers are a three-way decision set, not a lone sample: each of the
  three transcript-grounded concepts can receive its own cover, and the page
  provides a single bounded sequential action to create all three. The intended
  quality bar is dark, high-contrast editorial framing with exact headline copy
  on the left and authentic haircut action on the right.
- The feature branch now keeps the exact headline out of the image-model
  request. Thumbnail Maker owns it as editable app typography and exports the
  composed PNG. Each comparison set must contain one warning, one mistake, and
  one curiosity lane, with editable accent, graphic treatment, and visual focus.
  Exports render from a full-size 1536×864 composition and use only app-owned
  generated image data; they never depend on AI-rendered spelling or arbitrary
  local file access.
- The current thumbnail quality bar is editorial barber photography, not a
  generic vector-card template: full-bleed action, dimensional lighting and
  texture, a photographically shaped headline foreground, restrained display
  type, and no artificial annotation by default. A proof mark is optional only
  when it genuinely clarifies the exact technique rather than decorating it.
- The unmerged Thumbnail Maker includes a local Thumbnail Library: every
  generated three-option package is saved and can be reopened, refined, and
  saved again without another model request. Its records remain in app-owned
  storage and retain only validated local frame and cover paths.
