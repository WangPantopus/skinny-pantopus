#!/usr/bin/env bash
# Which of wave B's 23 findings actually landed before the agents died?
# All 7 agents errored on a session limit, so the tree holds partial work of
# unknown coverage. Probe each finding by the symbol/route it would have to
# introduce, on BOTH platforms.
set -uo pipefail
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
IOS="$ROOT/frontend/apps/ios/Pantopus"
AND="$ROOT/frontend/apps/android/app/src/main/java/app/pantopus/android"

probe() { # label | ios-needle | android-needle
  local label="$1" ineedle="$2" aneedle="$3"
  local i a
  i=$(grep -rl -- "$ineedle" "$IOS" 2>/dev/null | wc -l | tr -d ' ')
  a=$(grep -rl -- "$aneedle" "$AND" 2>/dev/null | wc -l | tr -d ' ')
  local v
  if [ "$i" -gt 0 ] && [ "$a" -gt 0 ]; then v="BOTH"
  elif [ "$i" -gt 0 ]; then v="iOS-only"
  elif [ "$a" -gt 0 ]; then v="Android-only"
  else v="NEITHER"; fi
  printf '%-34s ios:%-3s and:%-3s %s\n' "$label" "$i" "$a" "$v"
}

echo "===== gigs (13) ====="
probe "offers accept/reject/withdraw" "offers.\\\\(dto.id).accept" "offers_accept"
probe "gig Q&A upvote/pin/delete"     "questions/" "questions/"
probe "rebook rail"                   "RebookRail" "RebookRail"
probe "feed filters dist/deadline"    "max_distance" "max_distance"
probe "remind worker"                 "remindWorker" "remindWorker"
probe "withdraw counter"              "withdrawCounter" "withdrawCounter"
probe "edit task extra fields"        "cancellation_policy" "cancellation_policy"
probe "close/delete open task"        "closeGig" "closeGig"
probe "fulfillment stepper"           "fulfillment" "fulfillment"
probe "share live status"             "status-link" "status-link"
probe "feed scope support trains"     "support-trains/nearby" "support-trains/nearby"
probe "v2 scored offers"              "v2/offers" "v2/offers"
probe "share task to feed"            "PostTargetPicker" "PostTargetPicker"

echo
echo "===== mailbox (10) ====="
probe "family mail party"             "p3/party" "p3/party"
probe "package share ETA / gig / issue" "shareETA" "shareEta"
probe "stamps themes"                 "themes" "themes"
probe "mail day settings"             "mailday/settings" "mailday/settings"
probe "mail memory"                   "p3/memory" "p3/memory"
probe "vault server search"           "vault/search" "vault/search"
probe "booklet save/PDF"              "booklet" "booklet"
probe "certified proof"               "proof" "proof"
probe "real translation"              "v2/translate" "v2/translate"
probe "package help form"             "packageHelp" "packageHelp"
