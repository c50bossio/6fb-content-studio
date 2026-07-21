# Packaged pipeline end-to-end smoke — 2026-07-21

## Scope

Verify that the unsigned macOS arm64 app bundle's embedded pipeline can process
a disposable local video through transcript parsing, boundary validation,
clip extraction, tracking analysis, and vertical rendering without publishing
or invoking an external API.

This is a packaged-binary smoke, not a test of Anthropic clip selection,
Whisper model download/transcription, Electron IPC, signing, notarization, or
distribution.

## Fixture and safety controls

- Generated a disposable 52-second 640x360 H.264/AAC test-pattern video with
  the app bundle's embedded FFmpeg.
- Supplied a matching six-segment local SRT.
- Pre-seeded `output/clip_selections.json` with one 50-second, score-95 clip so
  the pipeline used its existing resume path instead of calling Anthropic.
- Unset API-key variables, enabled Hugging Face and Transformers offline modes,
  used only the bundled FFmpeg/FFprobe directory on `PATH`, passed `--no-post`,
  and omitted research, compose, notify, experiment, and studio-export flags.
- Wrote all input and output under a disposable `/tmp/6fb-packaged-e2e.*`
  directory.

## Invocation

The packaged executable was invoked from:

```text
release/mac-arm64/6FB Content Studio.app/Contents/Resources/python/runtime/darwin-arm64/pipeline/6fb-pipeline/6fb-pipeline
```

Arguments:

```text
--video <fixture.mp4> --transcript <fixture.srt> --brand 6fbarber
--clips 1 --output <disposable-output> --format 9x16 --no-post
```

## Result

PASS.

- Process exit: `0`.
- Transcript parse: 80 words, 6 sentences, 50.0 seconds.
- Selection: existing local selection loaded; no API selection was invoked.
- Boundary validation: retained one clip from 0.0 to 50.0 seconds. The
  synthetic continuous-tone fixture produced one expected warning that no
  natural silence was found near the end; this did not prevent extraction.
- Tracking analysis: 501 sampled frames and 501 crop-path keyframes. The
  synthetic pattern contained no real face, so face detection was 0%; pose and
  saliency analysis remained enabled and the normal renderer completed.
- Output: 50.067-second H.264/AAC MP4, 1080x1920, 30 fps, 48 kHz mono audio,
  42,719,937 bytes.
- Output SHA-256:
  `b2ae9c22ca3dd64eb668a59201c28ca72a9f48258ae4e547294c34804bc46d36`.
- The pipeline logged the clip as not posted and printed
  `--no-post: Nothing was published`.
- Frames extracted at 1, 25, and 49 seconds were visually inspected. All three
  were valid 1080x1920 frames containing the expected moving test pattern,
  confirming beginning, middle, and end video content rather than a header-only
  or truncated file.

## Remaining release boundaries

- Real-person face-following quality was not assessed by this synthetic smoke.
- Cloud AI selection and local Whisper transcription were intentionally not
  exercised.
- Signing, notarization, DMG creation, upload, tagging, and publishing remain
  unapproved and unperformed.
