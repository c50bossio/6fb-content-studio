# Delivery — CONTEXT

Last updated: 2026-07-21

## What happens here

Prepare and verify macOS and Windows packaging, release notes, signing and
notarization evidence, updater metadata, and external release availability.

## Audience and quality bar

- Audience: the release owner and barbers installing or updating the desktop app.
- Good work: ties every claim to an exact version, tag, commit, artifact, platform,
  and verification result; it clearly distinguishes built from published.
- Avoid: storing binaries here, exposing secrets, creating tags without approval,
  or treating a local build as proof of an externally available release.

## Process

1. Read `notes.md`, the relevant workflow, and the current version/tag state.
2. Prepare a checklist in `checklists/` and release copy in `release-notes/`.
3. Obtain explicit approval before creating tags or publishing externally.
4. Record exact artifact and availability proof in `evidence/`.

## Files here

- `notes.md` — current delivery truth, gates, and open questions.
- `checklists/` — platform-specific release readiness checklists.
- `release-notes/` — draft and approved release notes.
- `evidence/` — small text records of builds, hashes, CI, and availability checks.

## Rules

- Generated installers stay in ignored `release/`; never copy them into this workspace.
- Signing credentials remain in protected secret stores, never tracked files.
- Re-check current GitHub and artifact state before each state-changing release action.
- A tag, CI build, signed package, published release, and updater availability are separate gates.
