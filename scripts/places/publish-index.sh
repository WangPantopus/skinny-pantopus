#!/usr/bin/env bash
# Publishes a built places index (scripts/places/build-index.cjs) on the repo's `places-index` release, which the
# backend reads (backend/services/plans/placesIndex.js): the new data file first, then manifest.json, which
# switches readers over, then data files older than the previous one are removed (a server can still be reading
# the previous one for up to an hour). Refuses an index with under 80% of the published one's elements, so a
# broken build never replaces a good one. Run by .github/workflows/places-index.yml with GH_TOKEN set.
#
#   scripts/places/publish-index.sh <dir with manifest.json and the data file>
set -euo pipefail

dir="${1:?usage: publish-index.sh <index dir>}"
tag=places-index
data="$(jq -r .data "$dir/manifest.json")"
count="$(jq -r .count "$dir/manifest.json")"
[[ -f "$dir/$data" ]] || { echo "::error::$dir/$data is missing"; exit 1; }

if ! gh release view "$tag" >/dev/null 2>&1; then
  notes="Public places in the United States for the Plans place picker: parks, playgrounds, courts, libraries,
community centers, cafés, bars and restaurants, rebuilt monthly from OpenStreetMap (Geofabrik's extracts) by
.github/workflows/places-index.yml. Format: backend/services/plans/placesIndex.js.

Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0:
https://www.openstreetmap.org/copyright"
  gh release create "$tag" --title "Places index (OpenStreetMap)" --notes "$notes" --prerelease --latest=false \
    --target "${GITHUB_SHA:-master}"
fi

previous="$(mktemp -d)"
if gh release download "$tag" --pattern manifest.json --dir "$previous" 2>/dev/null; then
  before="$(jq -r .count "$previous/manifest.json")"
  if (( count * 10 < before * 8 )); then
    echo "::error::The new index has $count elements, the published one $before. Not publishing."
    exit 1
  fi
  echo "Published index: $before elements; new: $count."
fi

gh release upload "$tag" "$dir/$data" --clobber
gh release upload "$tag" "$dir/manifest.json" --clobber

# Keep the two newest data files (this one and the previous one).
gh release view "$tag" --json assets --jq '.assets[].name' | grep -E '^places-[0-9]{8}\.bin$' | sort -r \
  | tail -n +3 | while read -r old; do
    gh release delete-asset "$tag" "$old" --yes
    echo "Removed $old"
  done
echo "Published $data ($count elements)."
