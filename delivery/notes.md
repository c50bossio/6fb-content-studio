# Delivery notes

## Confirmed facts

- `package.json` currently reports version `1.5.39`.
- `.github/workflows/release.yml` builds, signs, notarizes, and publishes macOS artifacts on `v*` tags.
- `.github/workflows/release-windows.yml` builds and publishes Windows installer and portable artifacts on `v*` tags.
- Generated package output belongs in ignored `release/`.
- An unsigned, unpacked macOS arm64 app bundle for version `1.5.39` was built
  locally from commit `4e87bec` with signing, notarization, and publishing disabled.
  Its embedded pipeline runtime and production dashboard launch smoke passed.
- The current published release is `v1.5.42` at `0e20878`; its macOS workflow
  succeeded and the installed app verifies as notarized under Team ID
  `22X9VG6NUE`.
- A Developer ID-signed, unpacked local candidate from `a7ee13d` passed strict
  signature, hardened-runtime, embedded-runtime, and bounded launch checks.
  Notarization and publishing were disabled, so it is not distributable.

## Open questions

- The proposed next version is `v1.5.43`. Pull request #18 was nine commits
  ahead of `origin/main` at reviewed head `c4d2240`; this adversarial-review
  record adds one documentation-only commit. Its initial CodeRabbit review
  completed, all three findings were addressed in `395d36e`, and both inline
  threads are resolved. The owner explicitly skipped the quota-limited post-fix
  CodeRabbit wait. The adversarial merge-readiness review passed, but the pull
  request has not been merged, tagged, or published.
- Fresh `v1.5.43` updater and external availability cannot be verified until
  the explicitly approved tag workflows complete.

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
- Keep unsigned local bundle verification separate from signed, notarized, and
  externally published release claims.
- Keep the local signed-but-unnotarized proof separate from official
  notarization and Gatekeeper acceptance.
- Treat CodeRabbit's post-fix quota failure as an optional external-capacity
  limit, not a code failure; do not weaken local or post-merge verification.
