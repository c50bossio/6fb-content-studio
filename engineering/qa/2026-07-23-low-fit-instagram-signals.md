# Low-fit Instagram account-signal correction — 2026-07-23

## Discovery

Authenticated acceptance of the public macOS `v1.5.53` build connected the
owner's 6FB account and authorized Instagram professional account successfully.
The live picker truthfully labelled the account items as Instagram account
signals, but two returned captions had `Barber fit 0/100` and were still placed
in the topic list. That made unrelated personal account activity look like a
useful Content Studio topic.

## Correction

`SmartTrendService` now applies the same qualification rule to all live topic
sources: retain a score at or above `MIN_USEFUL_BARBER_FIT` (20), or a direct
barber-domain term. Source status remains live and explicitly says when recent
source items did not clear the threshold. This preserves a directly relevant
single-term caption such as a chair recap without surfacing unrelated personal
posts.

## Verification

- New unit regression: low-fit authorized Instagram media produces no picker
  idea, keeps Instagram status live, and falls back to labelled starters when
  no other qualified source exists.
- Full source checks passed: typecheck, 68 unit tests, 82 IPC contracts, CDP,
  docs, Python preflight, packaged-runtime probe, production build, Electron
  smoke, and strict workspace validation.
- Authenticated compiled-app acceptance used the same isolated account profile:
  the service reported six authorized Instagram media items as live, reported
  that none cleared barber fit 20, showed no `Barber fit 0/100` cards, and
  retained connected Content Planner topics. Renderer network/exception checks
  were clean; Electron's unpackaged CSP warning is expected and absent from
  packaged builds.
- Local signed macOS candidate package and mounted DMG both passed strict code
  signature verification. It is a local candidate only; signing/notarization
  and public publication remain separate release gates.
