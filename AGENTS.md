# 6FB Content Studio

6FB Content Studio is an Electron desktop application for barbers to plan,
create, edit, schedule, and measure content.

Last updated: 2026-07-22

> This is the canonical, model-independent project map. Read the routed
> workspace `CONTEXT.md` before acting; keep detailed context out of this file.

## Pickup and handoff

- `pickup`: read this file and `PROGRESS.md`, inspect the actual repo state, and
  give a read-only brief before changing anything.
- `handoff`: update `PROGRESS.md` with completed, in-progress, blocked, next,
  decisions, and verification evidence; read it back before stopping.
- Treat files and current test results as truth. Chat history is context only.

## Software boundary

- `src/` — React renderer, pages, components, hooks, and shared UI types.
- `electron/` — Electron main process, preload API, FFmpeg rendering, and Python bridge.
- `python/tools/` — clip extraction and content-pipeline source.
- `scripts/` — bundled-runtime, packaging, metadata, and smoke-test tooling.
- `.github/workflows/` — coordinated tag release automation and non-publishing
  Windows preflight.
- `assets/` and `public/` — application artwork and public renderer assets.
- `out/`, `release/`, `python/build/`, and `python/runtime/` are generated outputs,
  not source-of-truth workspaces.

## Workspaces

- `/product` — product direction, barber workflows, roadmap, and acceptance criteria.
- `/engineering` — implementation plans, architecture context, and verification evidence.
- `/delivery` — packaging, release readiness, release notes, and distribution proof.

## Routing

| Task | Go to | Read |
|------|-------|------|
| Define a feature, workflow, UX change, or acceptance criteria | `/product` | `CONTEXT.md` |
| Implement or diagnose renderer, Electron, Python, or build code | `/engineering` | `CONTEXT.md` |
| Verify a change and record build, test, or browser evidence | `/engineering` | `CONTEXT.md` |
| Package, sign, notarize, tag, publish, or verify a release | `/delivery` | `CONTEXT.md` |
| Resume or hand off the overall project | `/` | `PROGRESS.md` |

## Rules

- Route each task before working and preserve the existing runtime layout.
- Never move or rename runtime directories merely to match this folder app.
- Preserve user changes in a dirty worktree; inspect before editing.
- Do not invent product facts, customer details, test results, or release status.
- Never delete, skip, or weaken tests to make verification pass.
- Keep credentials and customer content out of tracked notes. Revocable local
  tokens may live only in gitignored `.env` files; passwords never do.
- External APIs require bounded retries, backoff where appropriate, and a hard
  failure cap. Prefer staging and narrow read-only validation.
- Production publishing, tags, GitHub Releases, social posting, customer
  messages, payments, bulk syncs, and schedulers require explicit approval.
- Update the routed `notes.md` when durable truth changes and `PROGRESS.md` at handoff.

## Naming

- Use lowercase kebab-case for workspace artifacts.
- Put generated artifacts only in their existing ignored output directories.
