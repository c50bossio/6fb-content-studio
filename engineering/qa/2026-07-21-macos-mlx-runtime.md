# macOS MLX runtime verification

Date: 2026-07-21

## Scope

- Diagnose the failing `darwin-arm64` packaged-runtime assertion.
- Restore MLX Metal support without moving application or runtime source paths.
- Prevent `runtime:mac` from reporting success for an unusable runtime.

## Root cause

The generated local runtime was older than the existing `mlx.metallib` bundling
logic. Its `mlx/lib` directory contained MLX dynamic libraries but not the 120 MB
`mlx.metallib`, so importing `mlx_whisper` failed during `--runtime-check`.

## Change

- Rebuilt the ignored `python/runtime/darwin-arm64` output from current source.
- Made the macOS builder fail immediately if `mlx.metallib` cannot be located.
- Made the builder run `assert-packaged-runtime.cjs` against its completed output.

## Verification

- `bash -n scripts/build-pipeline-runtime.sh` — passed.
- `npm run runtime:mac` — passed, including its new packaged-runtime assertion.
- `node scripts/assert-packaged-runtime.cjs darwin-arm64` — passed independently.
- `npm run build` — passed.
- `git diff --check` — passed.

Generated runtime and build directories remain ignored and are not source truth.
No signing, notarization, tag, release, or publishing action was performed.
