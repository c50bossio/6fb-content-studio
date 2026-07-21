# Local macOS signing readiness — 2026-07-21

## Scope

Validate the local Developer ID signing path against the already-tested macOS
arm64 app bundle without notarizing, tagging, uploading, or publishing.

Candidate source was commit
`a7ee13dc3c2c2289ccc8a75249b9f04ac23211c9` on
`codex/macos-mlx-runtime`.

## Release-state audit

- Refreshed `origin` and tags once.
- `origin/main` and the current published `v1.5.42` tag both resolve to
  `0e208788600a104280e8730ddb007a263808aa90`.
- GitHub Release `v1.5.42` is published with eight macOS and Windows assets.
- The macOS workflow for `v1.5.42` completed successfully.
- GitHub Actions exposes the required release secret names:
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, and `GH_TOKEN`. Secret values
  were not read.
- The tested source commit is five commits ahead of `origin/main`; the
  readiness record adds a sixth documentation-only branch commit. No candidate
  branch, pull request, merge, or tag was pushed during this gate.

## Signing identity

- Identity: `Developer ID Application: Christopher Bossio (22X9VG6NUE)`.
- SHA-1 identity hash:
  `24D0647223EC5F4CCEEA6F6F12E9FABC9FC1F999`.
- Certificate validity: 2026-04-03 through 2031-04-04.
- Certificate SHA-256 fingerprint:
  `33:AF:9A:06:F9:D8:47:2B:32:BF:9A:B7:3A:F1:62:72:6D:D2:36:8D:9F:69:04:02:28:A8:EA:DE:F4:24:A1:33`.
- The installed v1.5.42 app verifies as `Notarized Developer ID` with the same
  identifier and Team ID.

## Build command and controls

The complete runtime assertion and Electron production build ran before the
unpacked arm64 build. The successful builder invocation used the certificate
name/team selector and these controls:

```text
--mac --arm64 --dir --publish never
--config.forceCodeSigning=true
--config.mac.notarize=false
```

The first attempt supplied the full `Developer ID Application:` prefix in
`CSC_NAME`. Electron-builder rejected that selector before signing and asked
for the prefix to be removed. The complete runtime assertion, build, and
signing command was rerun with `Christopher Bossio (22X9VG6NUE)` and passed.
No test was skipped or weakened.

## Verification result

PASS for local signing readiness.

- `codesign --verify --deep --strict --verbose=4`: passed.
- Authority: Developer ID Application, Developer ID Certification Authority,
  and Apple Root CA.
- Team ID: `22X9VG6NUE`.
- Identifier: `com.6fbmentorship.contentstudio`.
- Architecture: arm64.
- Hardened runtime flag: `0x10000(runtime)`.
- Secure timestamp: 2026-07-21 12:20:01 America/New_York.
- Local bundle version: `1.5.39`, matching the source manifest. The release
  workflow must stamp and verify the proposed `1.5.43` version.
- Signed app main executable SHA-256:
  `a799d0024f0f4ee757d45bfbfb7e70a021dc34c23231e312c5bd38e357c2e4eb`.
- Embedded `mlx.metallib` SHA-256:
  `d0e75091ed30bef0ad87868bd79eeaf807f49294e8b60686a61451e79870d557`.
- Packaged runtime check passed for cv2, MediaPipe, MLX Whisper, SciPy
  interpolation, and YAML.
- Embedded FFmpeg and FFprobe version checks passed.
- Signed candidate remained alive for ten seconds with three helper processes
  under an isolated disposable profile, then stopped cleanly.

The first metadata command used a relative path with `defaults` and could not
resolve the plist domain. Metadata was immediately rechecked with an absolute
plist path and PlistBuddy; version, bundle version, and identifier all passed.

`spctl` reported `source=Unnotarized Developer ID` and exit 3. This is expected
because notarization was explicitly disabled for this local proof. It must not
be treated as a distributable artifact. Official Gatekeeper acceptance remains
a post-notarization release gate.
