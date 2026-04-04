#!/bin/bash
# build-notarized.sh — builds and notarizes 6FB Content Studio for distribution
# Run after: creating Developer ID Application cert + filling .env.build

set -e

echo "Loading build environment..."
if [ -f .env.build ]; then
  export $(grep -v '^#' .env.build | xargs)
else
  echo "ERROR: .env.build not found. Copy it and fill in your values."
  exit 1
fi

# Validate required vars
if [ -z "$APPLE_ID" ] || [ "$APPLE_ID" = "your@email.com" ]; then
  echo "ERROR: Set APPLE_ID in .env.build"
  exit 1
fi
if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ "$APPLE_APP_SPECIFIC_PASSWORD" = "xxxx-xxxx-xxxx-xxxx" ]; then
  echo "ERROR: Set APPLE_APP_SPECIFIC_PASSWORD in .env.build"
  echo "Get one at: https://appleid.apple.com → App-Specific Passwords"
  exit 1
fi
if [ -z "$GH_TOKEN" ] || [ "$GH_TOKEN" = "your_github_token_here" ]; then
  echo "ERROR: Set GH_TOKEN in .env.build"
  exit 1
fi

echo "✓ Environment ready"
echo "  Apple ID:  $APPLE_ID"
echo "  Team ID:   $APPLE_TEAM_ID"
echo ""
echo "Building and notarizing (this takes ~5 mins for notarization)..."

# Build + package + notarize + publish to GitHub Releases
npm run package:mac

echo ""
echo "✅ Done! Uploading to GitHub Releases..."
gh release upload v1.0.0 \
  "release/6FB Content Studio-1.0.0-arm64.dmg" \
  "release/6FB Content Studio-1.0.0-arm64-mac.zip" \
  "release/latest-mac.yml" \
  --clobber \
  --repo c50bossio/6fb-content-studio

echo ""
echo "✅ Notarized release live at:"
echo "   https://github.com/c50bossio/6fb-content-studio/releases/tag/v1.0.0"
echo ""
echo "Students can now double-click the .dmg — no Gatekeeper warning."
