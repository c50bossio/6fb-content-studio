# Product notes

Last updated: 2026-07-22

## Confirmed facts

- The product is a desktop content studio for barbers.
- Current visible surfaces include Dashboard, Brand & Brain, Video Planner,
  Clips, Carousel, Blog Writer, Video Editor, Scheduler, Analytics, and Settings.
- Public release `v1.5.45` is available for macOS arm64 and Windows.
- The source `package.json` remains at `1.5.39`; the existing tag workflows
  stamp the release version during packaging. The most recently independently
  downloaded and launched app reports version and build `1.5.44`; the live
  `v1.5.45` release metadata is verified but its installer was not recertified.

## Open questions

- Which workflows have recent direct barber feedback or usage evidence?

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
- `v1.5.45` supersedes `v1.5.44` and applies encoded local-media URLs across
  clip, carousel, blog, brand, scheduler, and editor previews.
- Ship v1.5.46 and the near-term product as macOS arm64 only. Defer Windows
  distribution and code-signing spend until Mac adoption provides evidence that
  the additional platform is justified. Preserve Windows build validation as a
  non-publishing future path; do not publish Windows assets now.
