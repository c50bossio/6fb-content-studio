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
npm run dev
```

Useful verification and packaging commands:

```bash
npm run build
npm run runtime:mac
npm run package:mac
npm run runtime:win
npm run package:win
```

macOS and Windows releases are tag-triggered through `.github/workflows/`.
Creating a tag or publishing a release is an explicit human approval gate.

## Workspace map

- `product/` — product decisions, briefs, and acceptance criteria.
- `engineering/` — implementation plans, architecture notes, and QA evidence.
- `delivery/` — release checklists, notes, and distribution evidence.

Do not treat chat history or generated build output as project truth. Verify
status against source files, current checks, and `PROGRESS.md`.
