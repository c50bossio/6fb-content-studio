# Delivery notes

## Confirmed facts

- `package.json` currently reports version `1.5.39`.
- `.github/workflows/release.yml` builds, signs, notarizes, and publishes macOS artifacts on `v*` tags.
- `.github/workflows/release-windows.yml` builds and publishes Windows installer and portable artifacts on `v*` tags.
- Generated package output belongs in ignored `release/`.
- An unsigned, unpacked macOS arm64 app bundle for version `1.5.39` was built
  locally from commit `4e87bec` with signing, notarization, and publishing disabled.
  Its embedded pipeline runtime and production dashboard launch smoke passed.

## Open questions

- Current external release and updater availability have not been verified in this organization pass.
- The packaged clip-extraction flow has not yet been exercised end to end with
  a disposable local video fixture.

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
- Keep unsigned local bundle verification separate from signed, notarized, and
  externally published release claims.
