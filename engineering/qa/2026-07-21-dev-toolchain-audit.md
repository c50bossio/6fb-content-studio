# Development-toolchain audit verification

Date: 2026-07-21

## Scope

- Applied the supported `npm audit fix` without `--force`.
- No `package.json`, renderer, Electron, or Python source changes.
- Patched React Router, Vite/esbuild, Babel, tar, tmp, undici, form-data,
  brace-expansion, and related lockfile entries within declared ranges.

## Passing evidence

- `npm ci` — passed; exact lockfile installation completed.
- `npm audit` — passed; zero vulnerabilities across production and development dependencies.
- `npm audit --omit=dev` — passed; zero production vulnerabilities.
- `npm run build` — passed with Vite 7.3.6 for main, preload, and renderer bundles.
- `npm run dev` — main and preload built, renderer served at localhost, and Electron started.
- `git diff --check` — passed.

## Separate finding

- `node scripts/assert-packaged-runtime.cjs darwin-arm64` failed because
  `mlx_whisper` could not load its default Metal library. Other reported runtime
  checks passed. This is a bundled-Python/runtime issue and was not changed as
  part of the JavaScript dependency repair.
