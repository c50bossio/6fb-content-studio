#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-${GITHUB_REF_NAME:-}}"
REPO="${GH_REPO:-c50bossio/6fb-content-studio}"
WORK_DIR="${2:-$(mktemp -d "${TMPDIR:-/tmp}/6fb-content-studio-dmg-smoke.XXXXXX")}"

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 v1.5.35 [work-dir]" >&2
  exit 2
fi

mkdir -p "$WORK_DIR"
DMG_NAME="6FB-Content-Studio-arm64.dmg"
DMG_PATH="$WORK_DIR/$DMG_NAME"
MOUNT_DIR="$WORK_DIR/mount"

cleanup() {
  if mount | grep -q "on $MOUNT_DIR "; then
    hdiutil detach "$MOUNT_DIR" -quiet || true
  fi
}
trap cleanup EXIT

echo "Downloading $DMG_NAME from $REPO@$TAG..."
rm -f "$DMG_PATH"
gh release download "$TAG" \
  --repo "$REPO" \
  --pattern "$DMG_NAME" \
  --dir "$WORK_DIR"

test -s "$DMG_PATH" || { echo "Downloaded DMG is missing or empty: $DMG_PATH" >&2; exit 1; }
xcrun stapler validate "$DMG_PATH"

rm -rf "$MOUNT_DIR"
mkdir -p "$MOUNT_DIR"
hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_DIR" -quiet

APP_PATH="$MOUNT_DIR/6FB Content Studio.app"
test -d "$APP_PATH" || { echo "App bundle not found in DMG: $APP_PATH" >&2; exit 1; }

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"

EXPECTED_VERSION="${TAG#v}"
ACTUAL_VERSION="$(defaults read "$APP_PATH/Contents/Info" CFBundleShortVersionString)"
if [[ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "Version mismatch in DMG app: expected $EXPECTED_VERSION, got $ACTUAL_VERSION" >&2
  exit 1
fi

echo "Published macOS DMG smoke passed for $TAG."
