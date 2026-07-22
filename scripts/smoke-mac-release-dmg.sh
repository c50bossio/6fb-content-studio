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
SOURCE_LABEL="published"
if [[ "${RELEASE_INCLUDE_DRAFT:-0}" == "1" ]]; then
  DRAFT_RELEASE_ID="${RELEASE_ID:-}"
  if [[ -z "$DRAFT_RELEASE_ID" ]]; then
    for attempt in 1 2 3; do
      DRAFT_RELEASE_ID="$(gh api "repos/$REPO/releases?per_page=100" --paginate \
        --jq ".[] | select(.tag_name == \"$TAG\" and .draft == true) | .id" 2>/dev/null | head -1 || true)"
      [[ -n "$DRAFT_RELEASE_ID" ]] && break
      sleep $((attempt * 2))
    done
  fi
  test -n "$DRAFT_RELEASE_ID" || { echo "Draft release not found for $TAG" >&2; exit 1; }
  ASSET_ID=""
  for attempt in 1 2 3; do
    ASSET_ID="$(gh api "repos/$REPO/releases/$DRAFT_RELEASE_ID/assets" \
      --jq ".[] | select(.name == \"$DMG_NAME\") | .id" 2>/dev/null | head -1 || true)"
    [[ -n "$ASSET_ID" ]] && break
    sleep $((attempt * 2))
  done
  test -n "$ASSET_ID" || { echo "Draft DMG asset not found for $TAG" >&2; exit 1; }
  for attempt in 1 2 3; do
    if gh api -H "Accept: application/octet-stream" \
      "repos/$REPO/releases/assets/$ASSET_ID" > "$DMG_PATH" && [[ -s "$DMG_PATH" ]]; then
      break
    fi
    rm -f "$DMG_PATH"
    sleep $((attempt * 2))
  done
  SOURCE_LABEL="staged draft"
else
  curl --fail --location --silent --show-error \
    --retry 2 --retry-delay 2 --retry-all-errors --max-time 900 \
    "https://github.com/$REPO/releases/download/$TAG/$DMG_NAME" \
    --output "$DMG_PATH"
fi

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

echo "macOS DMG smoke passed for $TAG from $SOURCE_LABEL release assets."
