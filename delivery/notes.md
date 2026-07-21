# Delivery notes

## Confirmed facts

- `package.json` currently reports version `1.5.39`.
- `.github/workflows/release.yml` builds, signs, notarizes, and publishes macOS artifacts on `v*` tags.
- `.github/workflows/release-windows.yml` builds and publishes Windows installer and portable artifacts on `v*` tags.
- Generated package output belongs in ignored `release/`.

## Open questions

- Current external release and updater availability have not been verified in this organization pass.

## Recent decisions

- Use `delivery/` for checklists and evidence only; do not move or duplicate generated artifacts.
- Treat tagging and publishing as explicit human approval gates.
