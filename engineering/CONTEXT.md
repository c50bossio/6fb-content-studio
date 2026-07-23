# Engineering — CONTEXT

Last updated: 2026-07-22

## What happens here

Plan, implement, diagnose, and verify changes across the existing React
renderer, Electron main/preload boundary, Python pipelines, and build tooling.

## Audience and quality bar

- Audience: maintainers shipping the macOS and Windows desktop application.
- Good work: preserves IPC contracts and packaged-runtime behavior, includes
  proportional regression proof, and clearly separates source from generated output.
- Avoid: moving runtime directories for neatness, editing generated bundles,
  weakening checks, or claiming packaged behavior from renderer-only proof.

## Process

1. Inspect `notes.md`, `package.json`, the affected source, and current git state.
2. Put non-trivial implementation plans in `plans/`; change source in its existing location.
3. Run the narrowest useful checks, then the broader build or smoke gate.
4. Save concise evidence in `qa/` and durable architecture decisions in `architecture/`.

## Runtime map

- Renderer: `src/`.
- Desktop process and IPC: `electron/`.
- Python source and models: `python/tools/`.
- Runtime/package tooling: `scripts/`, `electron.vite.config.ts`, and `package.json`.

## Rules

- Preserve preload/main/renderer contracts when changing IPC.
- Verify bundled Python and FFmpeg separately from the TypeScript build when affected.
- Never treat `out/`, `release/`, `python/build/`, or `python/runtime/` as source truth.
- Use bounded external calls and stop after repeated service failure.
