#!/usr/bin/env bash
#
# verify-overline.sh — the `.overline` role carries UPPERCASE, and a built
# `Text` cannot be re-cased (SwiftUI exposes no accessor for its own string).
# Casing therefore has to reach the role as a *string*, via
# `Text(copy, style: .overline)`.
#
# This lives on its own, rather than as another rule inside verify-tokens.sh,
# so it can actually gate: verify-tokens.sh exits non-zero on a large backlog
# of pre-existing hex/spacing/radii/font literals, which buries any new rule
# added to it. Run standalone with `make verify-overline`.
#
# It scans EVERY Swift target, including `_Internal` and the test targets —
# the chain form has previously existed in PantopusTests, and the debug token
# gallery is exactly the kind of place a silent casing drop hides.
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ROOTS=()
for d in Pantopus PantopusWidgets PantopusTests PantopusUITests; do
  [[ -d "$ROOT/$d" ]] && ROOTS+=("$ROOT/$d")
done

# The token file itself documents both patterns in prose.
EXCLUDE=( --exclude='Typography.swift' )

status=0

# --- A. The chain form with a literal role ---------------------------
# `Text("Foo").pantopusTextStyle(.overline)` renders "Foo" — the role never
# sees the string, so the UPPERCASE half of the token is silently dropped.
chain=$(grep -rnE "\.pantopusTextStyle\(\.overline\)" \
  "${ROOTS[@]}" --include='*.swift' "${EXCLUDE[@]}" 2>/dev/null || true)

if [[ -n "$chain" ]]; then
  echo "✗ verify-overline: .overline must be built with Text(_:style:) so the role can upper-case it:" >&2
  echo "$chain" >&2
  echo "" >&2
  echo "  Replace: Text(\"Assign to\").pantopusTextStyle(.overline)" >&2
  echo "  With:    Text(\"Assign to\", style: .overline)" >&2
  status=1
fi

# --- B. The chain form with a role held in a variable -----------------
# `.pantopusTextStyle(style)` cannot be read by pattern A, and drops casing
# for whichever roles carry it. A generic type-ramp helper must take the
# string too. An argument starting with `.` is an enum literal (a role that
# is not .overline is fine); anything else is a value and is flagged.
dynamic=$(grep -rnE "\.pantopusTextStyle\([^.)]" \
  "${ROOTS[@]}" --include='*.swift' "${EXCLUDE[@]}" 2>/dev/null || true)

if [[ -n "$dynamic" ]]; then
  echo "✗ verify-overline: a role passed as a value cannot carry casing — use Text(_:style:):" >&2
  echo "$dynamic" >&2
  echo "" >&2
  echo "  Replace: Text(copy).pantopusTextStyle(role)" >&2
  echo "  With:    Text(copy, style: role)" >&2
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  echo "✓ verify-overline: every .overline reaches the role as a string."
fi

exit "$status"
