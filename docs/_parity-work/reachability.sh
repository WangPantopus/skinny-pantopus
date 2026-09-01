#!/usr/bin/env bash
# Reachability audit for the parity branch.
#
# The original audit's dominant failure mode was screens that existed and
# compiled but had no production entry point (CeremonialMail wizard behind
# #if DEBUG, DisambiguateMailForm behind a debug dialog, listGuestPasses /
# revokeGuestPass / earnBalance / pending declared with zero call sites).
# This re-checks that shape for everything the branch added.
set -uo pipefail
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
AND="$ROOT/frontend/apps/android/app/src/main/java/app/pantopus/android"
IOS="$ROOT/frontend/apps/ios/Pantopus"
cd "$ROOT"

echo "############ ANDROID ROUTES ############"
# Parsing lives in android-routes.py — the registration and navigation forms in
# RootTabScreen.kt are too varied for a grep, and earlier grep-only versions
# reported PROFILE, TODAY_DETAIL and NOTIFICATIONS_ROUTE as unreachable when all
# three were fine.
python3 "$(dirname "${BASH_SOURCE[0]}")/android-routes.py" "$ROOT" "$AND"

echo
echo "############ ANDROID: new Api methods with zero repository/VM call sites ############"
git diff master...HEAD --name-only -- "${AND#$ROOT/}/data/api/services" \
  | while read -r f; do
      [ -f "$f" ] || continue
      iface=$(basename "$f" .kt)
      grep -oE 'suspend fun [a-zA-Z0-9_]+' "$f" | awk '{print $3}' | sort -u \
      | while read -r m; do
          [ -z "$m" ] && continue
          n=$(grep -rn "\.$m(" "$AND" --include='*.kt' 2>/dev/null | grep -vc "$f")
          [ "$n" -eq 0 ] && echo "  ZERO CALL SITES: $iface.$m"
        done
    done
echo "  (done)"

echo
echo "############ iOS: new endpoint helpers with zero call sites ############"
git diff master...HEAD --name-only -- "${IOS#$ROOT/}/Core/Networking/Endpoints" \
  | while read -r f; do
      [ -f "$f" ] || continue
      base=$(basename "$f" .swift)
      grep -oE 'static func [a-zA-Z0-9_]+' "$f" | awk '{print $3}' | sort -u \
      | while read -r m; do
          [ -z "$m" ] && continue
          n=$(grep -rn "\.$m(" "$IOS" 2>/dev/null | grep -vc "$f")
          [ "$n" -eq 0 ] && echo "  ZERO CALL SITES: $base.$m"
        done
    done
echo "  (done)"

echo
echo "############ BOTH: production entry points still behind debug gates ############"
grep -rn "BuildConfig.DEBUG" "$AND/ui/screens/you/YouScreen.kt" 2>/dev/null | head -20
echo "  --- iOS ---"
grep -rn "me\.debug\." "$IOS/Features/Me/MeViewModel.swift" 2>/dev/null | head -20
echo "  (done)"
