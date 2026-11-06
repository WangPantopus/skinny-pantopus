#!/usr/bin/env bash
# Publishes a built places index (scripts/places/build-index.cjs) on the repo's `places-index` release, which the
# backend reads: the Plans index (manifest.json, places-<date>.bin; backend/services/plans/placesIndex.js) and the
# post place-tag picker's venues index (venues-manifest.json, venues-<date>.bin; backend/services/geo/venues.js).
# For each: the new data file first, then its manifest, which switches readers over, then data files older than
# the previous one are removed (a server can still be reading the previous one for up to an hour). Refuses to
# publish either when one has under 80% of its published elements, so a broken build never replaces a good one.
# Run by .github/workflows/places-index.yml with GH_TOKEN set.
#
#   scripts/places/publish-index.sh <dir with the manifests and data files>
set -euo pipefail

dir="${1:?usage: publish-index.sh <index dir>}"
tag=places-index
# manifest name → data file prefix
sets=("manifest.json:places" "venues-manifest.json:venues")

if ! gh release view "$tag" >/dev/null 2>&1; then
  notes="Public places in the United States from OpenStreetMap (Geofabrik's extracts), rebuilt monthly by
.github/workflows/places-index.yml: for the Plans place picker, parks, playgrounds, courts, libraries, community
centers, cafés, bars and restaurants (manifest.json, places-*.bin); for the post place-tag picker, named venues
(venues-manifest.json, venues-*.bin). Format: backend/services/plans/placesIndex.js.

Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0:
https://www.openstreetmap.org/copyright"
  gh release create "$tag" --title "Places index (OpenStreetMap)" --notes "$notes" --prerelease --latest=false \
    --target "${GITHUB_SHA:-master}"
fi

# Every check before any upload.
previous="$(mktemp -d)"
for entry in "${sets[@]}"; do
  manifest="${entry%%:*}"
  data="$(jq -r .data "$dir/$manifest")"
  count="$(jq -r .count "$dir/$manifest")"
  [[ -f "$dir/$data" ]] || { echo "::error::$dir/$data is missing"; exit 1; }
  if gh release download "$tag" --pattern "$manifest" --dir "$previous" 2>/dev/null; then
    before="$(jq -r .count "$previous/$manifest")"
    if (( count * 10 < before * 8 )); then
      echo "::error::The new $manifest index has $count elements, the published one $before. Not publishing."
      exit 1
    fi
    echo "Published $manifest: $before elements; new: $count."
  fi
done

for entry in "${sets[@]}"; do
  manifest="${entry%%:*}"
  prefix="${entry##*:}"
  data="$(jq -r .data "$dir/$manifest")"
  gh release upload "$tag" "$dir/$data" --clobber
  gh release upload "$tag" "$dir/$manifest" --clobber
  # Keep the two newest data files (this one and the previous one).
  gh release view "$tag" --json assets --jq '.assets[].name' | grep -E "^${prefix}-[0-9]{8}\.bin$" | sort -r \
    | tail -n +3 | while read -r old; do
      gh release delete-asset "$tag" "$old" --yes
      echo "Removed $old"
    done
  echo "Published $data ($(jq -r .count "$dir/$manifest") elements)."
done
