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
