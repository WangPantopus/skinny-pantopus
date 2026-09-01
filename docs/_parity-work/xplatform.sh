#!/usr/bin/env bash
# Cross-platform endpoint-path parity for the branch.
#
# Extracts every API path string each app declares, normalises the two
# platforms' differing placeholder syntax ({id} vs \(id)), and reports paths
# that exist on only one side. A compile gate cannot catch this class of drift.
set -uo pipefail
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
IOS="$ROOT/frontend/apps/ios/Pantopus/Core/Networking/Endpoints"
AND="$ROOT/frontend/apps/android/app/src/main/java/app/pantopus/android/data/api/services"

norm() { sed -E 's/\{[^}]*\}/{}/g; s/\\\([^)]*\)/{}/g; s#^/##; s#/$##' | sort -u; }

# iOS: path: "..." literals
grep -rhoE 'path: "[^"]+"' "$IOS" | sed -E 's/path: "//; s/"$//' | norm > /tmp/x-ios.txt
# iOS: paths built via string interpolation in Endpoint(...) still land above.

# Android: @GET("...") / @POST(...) / @PATCH / @PUT / @DELETE annotations
grep -rhoE '@(GET|POST|PATCH|PUT|DELETE|HTTP)\("[^"]+"' "$AND" \
  | sed -E 's/@[A-Z]+\("//; s/"$//' | norm > /tmp/x-and.txt

echo "iOS declared paths:     $(wc -l < /tmp/x-ios.txt)"
echo "Android declared paths: $(wc -l < /tmp/x-and.txt)"
echo
echo "=== declared on iOS only ==="
comm -23 /tmp/x-ios.txt /tmp/x-and.txt
echo
echo "=== declared on Android only ==="
comm -13 /tmp/x-ios.txt /tmp/x-and.txt
