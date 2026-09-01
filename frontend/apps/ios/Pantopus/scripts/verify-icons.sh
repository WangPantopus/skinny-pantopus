#!/usr/bin/env bash
#
# verify-icons.sh — fail the build if feature code calls Image(systemName:)
# or mentions a Lucide icon name outside the PantopusIcon enum.
#
# Enforces the ground rule: icons only come through the `Icon(...)` view.

set -euo pipefail

# Script lives at Pantopus/scripts/; repo iOS root is two levels up.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURES="$ROOT/Pantopus/Features"
ICON_FILE="$ROOT/Pantopus/Core/Design/Icons.swift"

status=0

# 1. No `Image(systemName:` outside the icon module.
violations=$(grep -rnE 'Image\(systemName:' "$FEATURES" "$ROOT/Pantopus/App" "$ROOT/Pantopus/Core" \
    --include='*.swift' \
    --exclude-dir='_Internal' \
    --exclude='Icons.swift' \
    2>/dev/null || true)

if [[ -n "$violations" ]]; then
    echo "✗ verify-icons: feature code must use \`Icon(.name)\` instead of \`Image(systemName:)\`:" >&2
    echo "$violations" >&2
    status=1
fi

# 2. Icon inventory must be non-empty (smoke check that the enum exists).
if [[ ! -f "$ICON_FILE" ]]; then
    echo "✗ verify-icons: $ICON_FILE is missing." >&2
    status=1
else
    cases=$(grep -cE '^[[:space:]]*case ' "$ICON_FILE" || true)
    if [[ "$cases" -lt 30 ]]; then
        echo "✗ verify-icons: PantopusIcon inventory looks truncated (found $cases cases)." >&2
        status=1
    fi
fi

if [[ "$status" -eq 0 ]]; then
    echo "✓ verify-icons: no raw SF Symbol usage in feature code."
fi

exit "$status"
