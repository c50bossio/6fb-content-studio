#!/usr/bin/env bash
set -euo pipefail

TAG=${1:-}
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid release tag: $TAG" >&2
  exit 2
fi
if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "GITHUB_REPOSITORY is required" >&2
  exit 2
fi

output_root=${RUNNER_TEMP:-${TMPDIR:-/tmp}}
release_json="$output_root/6fb-public-release-${TAG}.json"
api_url="https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/tags/${TAG}"

# GitHub can take tens of seconds to expose a just-published release through
# its anonymous API. Keep this finite and anonymous: six attempts with
# exponential waits of 2, 4, 8, 16, and 32 seconds (62 seconds total).
max_attempts=6
for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  if curl --fail --silent --show-error --location \
    --retry 0 --connect-timeout 10 --max-time 60 \
    --header "Accept: application/vnd.github+json" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    --header "User-Agent: 6fb-content-studio-release-verifier" \
    "$api_url" > "$release_json"; then
    break
  fi

  if (( attempt == max_attempts )); then
    echo "Anonymous public release API did not become available after $max_attempts attempts" >&2
    exit 1
  fi

  delay=$((2 ** attempt))
  echo "Anonymous public release API is not available yet; retrying in ${delay}s ($attempt/$max_attempts)" >&2
  sleep "$delay"
done

release_state=$(jq -r '[.draft, .prerelease, .tag_name] | @tsv' "$release_json")
if [[ "$release_state" != $'false\tfalse\t'"$TAG" ]]; then
  echo "Public release state does not match $TAG: $release_state" >&2
  exit 1
fi

expected=(
  "6FB-Content-Studio-arm64.dmg"
  "6FB-Content-Studio-arm64.zip"
  "6FB-Content-Studio-arm64.zip.blockmap"
  "latest-mac.yml"
)
printf '%s\n' "${expected[@]}" | sort > "$output_root/expected-public-mac-assets.txt"
jq -r '.assets[].name' "$release_json" | sort > "$output_root/actual-public-mac-assets.txt"
if ! diff -u "$output_root/expected-public-mac-assets.txt" "$output_root/actual-public-mac-assets.txt"; then
  echo "Public release asset manifest is not exactly the four macOS files" >&2
  exit 1
fi

empty_assets=$(jq -r '.assets[] | select(.size <= 0) | .name' "$release_json")
if [[ -n "$empty_assets" ]]; then
  echo "Public release contains empty assets: $empty_assets" >&2
  exit 1
fi

echo "Public macOS release manifest verified: $TAG (4 non-empty assets)"
