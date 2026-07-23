# Thumbnail Maker

Last updated: 2026-07-22

## Outcome

Turn an existing transcribed Content Studio video into the same reviewed
packaging artifact used by the recent Content Machine / House Cut workflow.

## Workflow

1. The barber selects a completed Clip Extractor run.
2. Content Studio reads the existing local transcript.
3. ChatGPT returns one core diagnosis, exactly three title options, exactly
   three thumbnail concepts grounded in transcript timestamps, a description,
   and one CTA through the OpenAI API. The concepts deliberately cover one
   warning, one mistake, and one curiosity hook.
4. Content Studio matches each concept to an existing local clip frame when one
   is available, then generates a finished 16:9 cover from that owned reference
   frame when the user chooses a concept, or sequentially generates the
   three-concept comparison set. The image model creates the barbering visual;
   Content Studio renders the exact editable headline, accent, and simple
   graphic treatment itself before export. The renderer treats the output as an
   editorial cover: full-bleed photography, dimensional grading, and headline
   placement shaped by photographic depth rather than a flat black type panel.
5. The user reviews, copies, or exports the package as Markdown. Finished PNGs
   remain in app-owned storage. Every generated three-option package is also
   saved in the local Thumbnail Library, where the user can reopen it, refine
   its director controls, and save the revised set. Nothing is posted or
   published.

## Acceptance criteria

- Thumbnail text is two to four words and does not repeat a proposed title.
- Every thumbnail concept includes a visual direction, transcript evidence, and
  a valid transcript timestamp.
- Every visual direction makes one concrete visual argument: one headline,
  one transcript-grounded proof cue visible in the barbering frame, and one
  restrained accent system. The image model must leave all text and annotations
  to the renderer.
- Generated packages contain exactly three distinct titles and three distinct
  thumbnail concepts or fail closed with a useful error.
- Each concept can create one finished 1536×1024 PNG through OpenAI's image
  generation API, using only an app-owned source frame and a bounded request.
- The comparison set contains three visually distinct finished covers, one for
  each generated direction: warning, mistake, and curiosity. Covers prioritize
  full-bleed, dark high-contrast editorial photography, an exact app-rendered
  headline integrated into the left foreground, and authentic barbering action
  on the right. The design must not become a hard black type panel or a flat
  vector-card treatment.
- Every concept exposes editable director controls for the exact headline,
  creative lane, accent, graphic treatment, and visual proof cue. Exported PNGs
  preserve the app-rendered headline rather than relying on AI typography, at
  a true full-size 1536×864 composition rather than a scaled editor card.
- The tool works from app-owned transcribed runs and never grants broad access
  to arbitrary filesystem paths.
- Generated packages persist as validated local records under app-owned storage.
  Reopening a package restores its three titles, directions, local cover paths,
  and editable controls without rerunning any model request.
- Missing transcript, missing OpenAI key, malformed AI output, and missing frame
  states are explicit and recoverable.
- The page is usable at 375, 768, and 1440 px without horizontal overflow or
  undersized controls.

## Non-goals

- Uploading to YouTube or another platform.
- Re-transcribing videos or introducing a second media pipeline.
- Changing House Cut's human thumbnail approval gate.
