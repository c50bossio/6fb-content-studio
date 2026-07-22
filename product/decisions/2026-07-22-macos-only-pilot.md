# Decision: macOS-only pilot distribution

Date: 2026-07-22

## Decision

Ship v1.5.46 and the near-term 6FB Content Studio pilot for macOS arm64 only.
Do not publish Windows installers or incur Windows code-signing cost until Mac
adoption shows that a second desktop platform is justified.

## Why

The immediate goal is to prove product adoption, not maximize platform breadth.
macOS already has a verified Developer ID signing, notarization, stapling, and
downloaded-app certification path. A Windows launch adds packaging acceptance,
Authenticode identity, updater, support, and ongoing release obligations before
there is adoption evidence that those costs create value.

## Tradeoffs

- Windows users cannot install an official near-term release.
- Historical Windows portability work remains useful but is not customer-facing
  release proof.
- Deferring Windows reduces launch breadth while simplifying release safety and
  support during the pilot.
- The owner approved a provisional adoption and direct-demand gate through pull
  request #35. Its low-confidence numbers must be revisited prospectively after
  initial pilot evidence.

## Acceptance criteria

- The production tag workflow builds and publishes macOS arm64 only.
- Draft and public release manifests contain exactly the DMG, updater ZIP, ZIP
  blockmap, and `latest-mac.yml`, all non-empty.
- No Windows executable, blockmap, or updater metadata appears in v1.5.46.
- The staged DMG must pass signing, notarization, Gatekeeper, and version checks
  before publication; an independent public-DMG launch remains a separate
  post-publication acceptance gate.
- Windows packaging remains available only as an explicit non-publishing manual
  validation for a future product decision.

## Revisit rule

Use the approved provisional evidence gate in
`2026-07-22-windows-reconsideration-threshold.md`. Crossing the gate opens a
fresh business, signing, certification, and support review; it does not approve
Windows spend, publication, or distribution.
