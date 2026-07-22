# 6FB Content Studio

6FB Content Studio is an Electron desktop application that helps barbers plan
videos, extract and edit clips, create carousels and blog posts, schedule
Instagram content, manage brand settings, and review local analytics.

## Start here

1. Agents and coding assistants: read [`AGENTS.md`](./AGENTS.md), then follow its routing table.
2. Humans: check [`PROGRESS.md`](./PROGRESS.md) for current project state.
3. Claude-compatible tools: [`CLAUDE.md`](./CLAUDE.md) routes to the same canonical instructions.

The folder-app files are an operating layer around the software. Application
source remains in `src/`, `electron/`, and `python/tools/`; generated builds
remain in the existing ignored output directories.

## Development

```bash
npm ci
npm test
npm run dev
```

Useful verification and packaging commands:

```bash
npm run build
npm run qa:visual
npm run qa:visual:self-test
npm run validate:workspace:strict
npm run validate:workspace:portable
npm run runtime:mac
npm run package:mac
npm run runtime:win
npm run package:win
```

The coordinated tag workflow in `.github/workflows/release.yml` builds both
platforms, stages all eight artifacts, verifies the notarized macOS DMG, and
only then publishes the release. The reusable Windows workflow also supports a
non-publishing manual dry run before tagging.
Creating a tag or publishing a release is an explicit human approval gate.

`npm run qa:visual` starts an isolated renderer server, captures every screen at
375, 768, and 1440 px, and fails on overflow, clipped controls, undersized touch
targets, error overlays, console errors, or failed/4xx/5xx network activity.
`npm run qa:visual:self-test` injects all three finding classes and proves the
gate exits nonzero. Google Chrome is the default; set `CHROME_PATH` when a
Chromium-compatible browser is installed elsewhere.

## Workspace map

- `product/` — product decisions, briefs, and acceptance criteria.
- `engineering/` — implementation plans, architecture notes, and QA evidence.
- `delivery/` — release checklists, notes, and distribution evidence.

Do not treat chat history or generated build output as project truth. Verify
status against source files, current checks, and `PROGRESS.md`.
