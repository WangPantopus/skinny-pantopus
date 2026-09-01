#!/usr/bin/env bash
# Targeted parity check: for each backend route the 64 high findings required,
# confirm BOTH platforms reference it somewhere. Substring match on a
# distinctive path fragment, so it survives the two apps' different idioms
# (Swift string interpolation / a path() helper vs Retrofit annotations).
set -uo pipefail
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
IOS="$ROOT/frontend/apps/ios/Pantopus"
AND="$ROOT/frontend/apps/android/app/src/main/java/app/pantopus/android"

FRAGMENTS="
homes/%s/dashboard|health-score|seasonal-checklist|property-value|bill-trends
household-access-requests|homes/discover|request-household-from-owner|residency-claims
/issues|verify-postcard|owners/transfer|ownership-claims|guest-passes
v1/tenant|/security
mailbox/v2/pending|mailbox/v2/resolve|p3/community|p3/records|v2/earn
p3/tasks/from-mail|to-gig|p2/package|p3/vacation|p3/map
my-bid|worker-release|reopen-bidding|magic-post
businesses/invoices|payments/history|connect/dashboard
support-trains|identity/search|posts/map|feed-preferences|posts/mute|posts/hide
not-helpful|/solve|posts/seeded|hub/discovery|notifications|relationships
users/account|hub/preferences|privacy/settings|upload/profile-picture
users/username|/follow|professional/profile
api/personas|upload/persona-media|catalog/categories|catalog/items
stripe/connect|stripe/account|verify/status|/private
pages|revisions|dms/threads|membership/upgrade|membership/downgrade|refund-request
"

printf '%-34s %-6s %-8s %s\n' FRAGMENT iOS Android VERDICT
echo "$FRAGMENTS" | tr '|' '\n' | sed '/^[[:space:]]*$/d' | while read -r frag; do
  frag=$(echo "$frag" | sed 's/%s/{}/' | xargs)
  [ -z "$frag" ] && continue
  # strip the placeholder so the substring matches either idiom
  needle=$(echo "$frag" | sed 's#/{}/#/#')
  i=$(grep -rl "$needle" "$IOS" 2>/dev/null | wc -l | tr -d ' ')
  a=$(grep -rl "$needle" "$AND" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$i" -gt 0 ] && [ "$a" -gt 0 ]; then v=ok
  elif [ "$i" -eq 0 ] && [ "$a" -eq 0 ]; then v="MISSING BOTH"
  elif [ "$i" -eq 0 ]; then v="iOS MISSING"
  else v="ANDROID MISSING"; fi
  [ "$v" = ok ] || printf '%-34s %-6s %-8s %s\n' "$needle" "$i" "$a" "$v"
done
echo "(only non-ok rows shown)"
