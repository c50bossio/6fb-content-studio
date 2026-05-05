#!/usr/bin/env bash
set -euo pipefail

KEYCHAIN_PATH="${1:-}"
IDENTITY_PATTERN="${2:-Developer ID Application:}"

if [[ -z "$KEYCHAIN_PATH" ]]; then
  echo "Usage: $0 <keychain-path> [identity-pattern]" >&2
  exit 2
fi

mapfile -t IDENTITY_HASHES < <(
  security find-identity -v -p codesigning "$KEYCHAIN_PATH" |
    awk -v pattern="$IDENTITY_PATTERN" '$0 ~ pattern { print $2 }'
)

if [[ "${#IDENTITY_HASHES[@]}" -le 1 ]]; then
  echo "Signing identity pruning not needed for pattern: $IDENTITY_PATTERN"
  exit 0
fi

KEEP_HASH="${CSC_IDENTITY_HASH:-${APPLE_DEVELOPER_ID_HASH:-${IDENTITY_HASHES[0]}}}"
echo "Keeping signing identity: $KEEP_HASH"

for hash in "${IDENTITY_HASHES[@]}"; do
  if [[ "$hash" == "$KEEP_HASH" ]]; then
    continue
  fi
  echo "Deleting duplicate signing identity: $hash"
  security delete-certificate -Z "$hash" "$KEYCHAIN_PATH" >/dev/null
done

security find-identity -v -p codesigning "$KEYCHAIN_PATH"
