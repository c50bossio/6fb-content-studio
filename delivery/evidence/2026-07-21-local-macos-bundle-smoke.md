# Local unsigned macOS bundle smoke

Date: 2026-07-21

## Artifact identity

- Source branch: `codex/macos-mlx-runtime`
- Source commit: `4e87bec2562b1ca8461a8fce41ea0241d463551b`
- App version: `1.5.39`
- Bundle identifier: `com.6fbmentorship.contentstudio`
- Platform: macOS arm64
- Generated path: `release/mac-arm64/6FB Content Studio.app`
- App bundle size: 1.1 GB
- Main executable SHA-256: `afa086d829713c1385c6f15999898a8b959af24abb46df949ac324047afc30a7`

## Build boundary

The unpacked app was built with:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 --dir \
  --publish never --config.mac.identity=null --config.mac.notarize=false
```

Electron-builder reported that macOS code signing was skipped because identity
was explicitly `null`. The effective configuration recorded `identity: null`
and `notarize: false`. No tag, signing, notarization, installer, upload, or
publishing action was performed.

## Embedded runtime verification

- App executable is a Mach-O arm64 binary.
- Embedded `mlx.metallib` exists, is 120 MB, and has SHA-256
  `d0e75091ed30bef0ad87868bd79eeaf807f49294e8b60686a61451e79870d557`.
- Embedded `6fb-pipeline --runtime-check` passed with `cv2`, `mediapipe`,
  `mlx_whisper`, `scipy.interpolate`, and `yaml` all true.
- Embedded `6fb-pipeline --help` passed.
- Embedded FFmpeg and FFprobe version checks passed.
- `app.asar` contains main, preload, renderer HTML, CSS, JavaScript, and logo assets.

## Launch smoke

The exact generated production app bundle was started with a fresh disposable
`--user-data-dir`. Its main, helper, network-service, and renderer processes
remained running, and visual inspection of the exact process window confirmed
the version `1.5.39` dashboard rendered with navigation, first-run workflow,
metrics, and tool cards visible.

The unpacked directory bundle does not contain `app-update.yml`, so the updater
logged a local `ENOENT` warning and made no update request. An attempted outer
`sandbox-exec` wrapper was incompatible with Electron's helper sandbox and was
abandoned; the normal isolated launch passed. The pre-existing installed app
process was left running and untouched. Disposable smoke profiles and the
temporary screenshot were moved to Trash after verification.

## Result

Local unsigned bundle build, embedded-runtime validation, and production launch
smoke passed. This is not evidence of Developer ID signing, notarization, DMG
installation, updater availability, or an externally published release.
