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

- The proposed next version is `v1.5.43`. The tested source stack is five
  commits ahead of `origin/main`, and the readiness record adds one docs-only
  commit. Pull request #18 is ready for human review. Its initial CodeRabbit
  review completed, and all three findings were addressed in `395d36e`; the
  post-fix review is temporarily rate limited. The pull request has not been
  merged, tagged, or published.
- Fresh `v1.5.43` updater and external availability cannot be verified until
  the explicitly approved tag workflows complete.

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
- Keep unsigned local bundle verification separate from signed, notarized, and
  externally published release claims.
- Keep the local signed-but-unnotarized proof separate from official
  notarization and Gatekeeper acceptance.
