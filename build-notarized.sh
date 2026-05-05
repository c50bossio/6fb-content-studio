#!/usr/bin/env bash
# Build, notarize, staple, and upload macOS release artifacts for a tag.
# Prefer the GitHub Actions release workflow for official releases.

set -euo pipefail

TAG="${1:-${GITHUB_REF_NAME:-}}"
REPO="${GH_REPO:-c50bossio/6fb-content-studio}"
TEMP_KEYCHAIN_PATH=""
TEMP_KEYCHAIN_DIR=""
TEMP_CERT_PATH=""
ORIGINAL_KEYCHAINS=""

cleanup() {
  if [[ -n "$ORIGINAL_KEYCHAINS" ]]; then
    # shellcheck disable=SC2086
    security list-keychains -d user -s $ORIGINAL_KEYCHAINS >/dev/null 2>&1 || true
  fi
  if [[ -n "$TEMP_KEYCHAIN_PATH" ]]; then
    security delete-keychain "$TEMP_KEYCHAIN_PATH" >/dev/null 2>&1 || true
  fi
  if [[ -n "$TEMP_KEYCHAIN_DIR" ]]; then
    rm -rf "$TEMP_KEYCHAIN_DIR"
  fi
  if [[ -n "$TEMP_CERT_PATH" ]]; then
    rm -f "$TEMP_CERT_PATH"
  fi
}
trap cleanup EXIT

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 v1.5.35" >&2
  exit 2
fi
if [[ "$TAG" != v* ]]; then
  echo "ERROR: release tag must start with v, got: $TAG" >&2
  exit 2
fi
VERSION="${TAG#v}"

if [[ -f .env.build ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.build
  set +a
fi

missing=0
for name in APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID GH_TOKEN; do
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: missing required env var: $name" >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

if [[ -n "${APPLE_CERTIFICATE:-}" || -n "${APPLE_CERTIFICATE_PASSWORD:-}" ]]; then
  if [[ -z "${APPLE_CERTIFICATE:-}" || -z "${APPLE_CERTIFICATE_PASSWORD:-}" ]]; then
    echo "ERROR: APPLE_CERTIFICATE and APPLE_CERTIFICATE_PASSWORD must be set together." >&2
    exit 1
  fi

  TEMP_KEYCHAIN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/6fb-content-studio-signing.XXXXXX")"
  TEMP_KEYCHAIN_PATH="$TEMP_KEYCHAIN_DIR/build.keychain"
  TEMP_CERT_PATH="$(mktemp "${TMPDIR:-/tmp}/6fb-content-studio-cert.XXXXXX.p12")"
  KEYCHAIN_PASSWORD="$(openssl rand -base64 32)"
  ORIGINAL_KEYCHAINS="$(security list-keychains -d user | tr -d '"')"

  security create-keychain -p "$KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN_PATH"
  security set-keychain-settings -lut 21600 "$TEMP_KEYCHAIN_PATH"
  security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN_PATH"
  echo "$APPLE_CERTIFICATE" | base64 --decode > "$TEMP_CERT_PATH"
  security import "$TEMP_CERT_PATH" \
    -k "$TEMP_KEYCHAIN_PATH" \
    -P "$APPLE_CERTIFICATE_PASSWORD" \
    -T /usr/bin/codesign \
    -T /usr/bin/security
  security set-key-partition-list \
    -S apple-tool:,apple:,codesign: \
    -s -k "$KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN_PATH"
  bash scripts/prune-mac-signing-identities.sh "$TEMP_KEYCHAIN_PATH"
  # shellcheck disable=SC2086
  security list-keychains -d user -s "$TEMP_KEYCHAIN_PATH" $ORIGINAL_KEYCHAINS
  export CSC_KEYCHAIN="$TEMP_KEYCHAIN_PATH"
  echo "Using temporary signing keychain for this build."
else
  echo "APPLE_CERTIFICATE not set; using existing keychain signing identities."
fi

if [[ "${ALLOW_DIRTY_RELEASE:-0}" != "1" && -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty. Commit/stash changes or set ALLOW_DIRTY_RELEASE=1." >&2
  exit 1
fi

gh release view "$TAG" --repo "$REPO" >/dev/null || {
  echo "ERROR: GitHub release does not exist yet for $TAG in $REPO" >&2
  exit 1
}

echo "Building 6FB Content Studio $TAG for macOS..."
rm -rf release
npm run runtime:mac
npm version "$VERSION" --no-git-tag-version --allow-same-version
npm run package:mac:release -- --publish never

DMG_PATH="$(find release -maxdepth 1 -type f -name '6FB-Content-Studio-*.dmg' | sort | head -1)"
ZIP_PATH="$(find release -maxdepth 1 -type f -name '6FB-Content-Studio-*.zip' | sort | head -1)"
ZIP_BLOCKMAP_PATH="$(find release -maxdepth 1 -type f -name '6FB-Content-Studio-*.zip.blockmap' | sort | head -1)"
YML_PATH="release/latest-mac.yml"

for artifact in "$DMG_PATH" "$ZIP_PATH" "$ZIP_BLOCKMAP_PATH" "$YML_PATH"; do
  if [[ -z "$artifact" || ! -f "$artifact" ]]; then
    echo "ERROR: missing release artifact: ${artifact:-unknown}" >&2
    exit 1
  fi
done

codesign --verify --deep --strict --verbose=2 "release/mac-arm64/6FB Content Studio.app"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
node scripts/normalize-mac-update-metadata.cjs "$YML_PATH" "$ZIP_PATH"
if grep -q '\.dmg' "$YML_PATH"; then
  echo "ERROR: latest-mac.yml must reference ZIP, not DMG" >&2
  exit 1
fi

UPLOAD_FLAGS=()
if [[ "${GH_RELEASE_CLOBBER:-0}" == "1" ]]; then
  UPLOAD_FLAGS+=(--clobber)
fi

gh release upload "$TAG" \
  "$DMG_PATH" \
  "$ZIP_PATH" \
  "$YML_PATH" \
  "$ZIP_BLOCKMAP_PATH" \
  --repo "$REPO" \
  ${UPLOAD_FLAGS[@]+"${UPLOAD_FLAGS[@]}"}

bash scripts/smoke-mac-release-dmg.sh "$TAG"

echo "Release artifacts uploaded and smoke-tested for $TAG."
