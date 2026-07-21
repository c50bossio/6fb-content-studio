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
- The full audit still reports 10 development-tooling advisories (2 low, 7 high,
  1 critical). `npm audit --omit=dev` is clean, so production dependencies are
  not affected by those remaining findings.

## Recent decisions

- Keep all implementation source in its existing runtime directories.
- Store only plans, architecture context, and verification evidence here.
- Applied the supported production-only audit repair: `fast-uri@3.1.4`,
  `js-yaml@4.3.0`, and `ws@8.21.1`; `npm audit --omit=dev` and `npm run build` passed.
- Address development-tooling audit fixes separately because the broad automatic
  plan changes the Vite, React Router, Babel, esbuild, and other toolchain trees.
