#!/bin/bash
# For each candidate PR: current head, whether ci-watch.seen recorded CI OK=pass for exactly that head,
# PR state and base. Prints READY / NOTREADY lines. Uses REST only.
REPO=WangPantopus/skinny-pantopus; SEEN=/private/tmp/pantopus-tools/ci-watch.seen
for n in "$@"; do
  j=$(gh api "repos/$REPO/pulls/$n" --jq '"\(.state) \(.merged) \(.base.ref) \(.head.sha)"' 2>/dev/null) || { echo "ERR $n"; continue; }
  set -- $j; st=$1; merged=$2; base=$3; sha=$4; h=${sha:0:9}
  if [ "$merged" = "true" ]; then echo "MERGED $n"; continue; fi
  if [ "$st" != "open" ]; then echo "CLOSED $n"; continue; fi
  if grep -qE "^$n $h pass$" "$SEEN"; then echo "READY $n $sha base=$base"; else
    c=$(gh api "repos/$REPO/commits/$sha/check-runs?check_name=CI%20OK&per_page=10" --jq '[.check_runs[]|select(.status=="completed")]|sort_by(.completed_at)|last|.conclusion // "pending"' 2>/dev/null)
    if [ "$c" = "success" ]; then echo "READY $n $sha base=$base (ci via api)"; else echo "NOTREADY $n $h ci=$c base=$base"; fi
  fi
done
