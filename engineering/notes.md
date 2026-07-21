# Engineering notes

## Confirmed facts

- The renderer uses React 19 with Electron Vite and TypeScript.
- Electron owns settings, filesystem access, media rendering, scheduling,
  Instagram integration, analytics aggregation, and the Python bridge.
- `python/tools/clip_extractor/` and `python/tools/pipeline/` contain pipeline source.
- `npm run build` is the base TypeScript/Electron build gate.
- Runtime packaging has separate macOS and Windows build and assertion scripts.

## Open questions

- There is no dedicated test script in `package.json`; feature verification must
  currently combine build checks with targeted smoke or manual flows.

## Recent decisions

- Keep all implementation source in its existing runtime directories.
- Store only plans, architecture context, and verification evidence here.
- Applied the supported production-only audit repair: `fast-uri@3.1.4`,
  `js-yaml@4.3.0`, and `ws@8.21.1`; `npm audit --omit=dev` and `npm run build` passed.
- Applied the supported development-tooling audit repair within declared package
  ranges. The full audit is clean, the Electron production build passes, and a
  bounded development launch reached the renderer server and started the app.
- Rebuilt the stale macOS arm64 pipeline runtime so it includes MLX's
  `mlx.metallib`, and made `runtime:mac` fail if that library is unavailable or
  the completed runtime does not pass its packaged-runtime check.
- Ran the unsigned app bundle's embedded pipeline end-to-end against a
  disposable offline fixture. Transcript parsing, boundary validation, clip
  extraction, crop-path analysis, and 1080x1920 H.264/AAC rendering completed;
  external selection, posting, notifications, and exports were not invoked.
