# Electron IPC cleanup-race repair — 2026-07-23

## Failure observed

- Tagged macOS workflow `30040399048` for failed, non-published `v1.5.54`
  passed all 68 unit tests, 82 IPC contracts, CDP, documentation, Python,
  packaged-runtime, build, and Electron IPC functional assertions.
- The job then failed at `scripts/test-electron-ipc.cjs:364` while removing its
  disposable profile: `ENOTEMPTY, Directory not empty`.
- The harness had sent `SIGTERM`, waited a fixed 300 ms, and removed the
  directory without waiting for Electron exit or handling a transient writer.

## Repair

- `scripts/electron-ipc-cleanup.cjs` sends `SIGTERM`, waits up to two seconds,
  sends `SIGKILL` only if needed, and fails if the child still does not exit.
- Its directory removal retries only `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`,
  and `EPERM`, at most ten times with a 100 ms delay. All other failures are
  surfaced immediately.
- `scripts/test-electron-ipc-cleanup.cjs` deterministically proves graceful
  exit, forced exit, bounded transient retry, and non-transient propagation.

## Local proof

- `npm run build` passed.
- `npm run test:electron` passed both the cleanup contract and the real
  isolated Electron IPC smoke.
- The complete source/contract/docs/Python/runtime/build/Electron sequence
  passed: typecheck, 68 unit tests, 82 IPC contracts, CDP, docs, Python,
  packaged-runtime assertion, production build, and Electron smoke.
- `npm run validate:workspace:strict` passed with zero findings after updating
  the engineering map timestamp.

## Boundary

This is local branch proof. A fresh exact-main test run and a new, separately
approved `v1.5.55` tag workflow are still required before any release claim.
