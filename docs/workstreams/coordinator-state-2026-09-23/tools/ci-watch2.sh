#!/bin/bash
# Emit one line per PR when its "CI OK" check completes for the PR's current head, and once when a watched PR
# merges or closes. PR numbers to watch: one per line in /private/tmp/pantopus-tools/ci-watch.txt (append to add).
#
# Uses the REST API only (the GraphQL budget is shared with the stream agents' gh calls): one open-PR list per
# loop, then one check-runs call per watched open PR whose current head hasn't reported yet.
W=/private/tmp/pantopus-tools/ci-watch.txt; SEEN=/private/tmp/pantopus-tools/ci-watch.seen
REPO=WangPantopus/skinny-pantopus
touch "$W" "$SEEN"
while true; do
  open=$(gh api "repos/$REPO/pulls?state=open&per_page=100" --jq '.[] | "\(.number) \(.head.sha) \(.head.ref)"' 2>/dev/null) || { sleep 120; continue; }
  # Watch every open claude/* PR automatically, plus anything listed in $W.
  for n in $(echo "$open" | awk '$3 ~ /^claude\//{print $1}'); do grep -qx "$n" "$W" || echo "$n" >> "$W"; done
  for n in $(grep -E '^[0-9]+$' "$W" | sort -u); do
    grep -qE "^$n [^ ]+ (MERGED|CLOSED)$" "$SEEN" && continue
    sha=$(echo "$open" | awk -v n="$n" '$1==n{print $2}')
    if [ -z "$sha" ]; then
      st=$(gh api "repos/$REPO/pulls/$n" --jq 'if .merged then "MERGED" elif .state=="closed" then "CLOSED" else "OPEN" end' 2>/dev/null) || continue
      [ "$st" = "OPEN" ] && continue
      echo "PR$n $st"; echo "$n - $st" >> "$SEEN"; continue
    fi
    head=${sha:0:9}
    grep -qE "^$n $head (pass|fail|cancel)$" "$SEEN" && continue
    c=$(gh api "repos/$REPO/commits/$sha/check-runs?check_name=CI%20OK&per_page=10" \
      --jq '[.check_runs[]] | sort_by(.id) | last | if . == null then "none" elif .status != "completed" then "running" else (.conclusion // "none") end' 2>/dev/null)
    case "$c" in
      success) b=pass;; failure|timed_out) b=fail;; cancelled) b=cancel;; *) continue;;
    esac
    f=""
    if [ "$b" != pass ]; then
      f=$(gh api "repos/$REPO/commits/$sha/check-runs?per_page=100" \
        --jq '[.check_runs[] | select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out") | .name] | unique | join(",")' 2>/dev/null | cut -c1-300)
    fi
    echo "PR$n head $head CI OK=$b ${f:+failed: $f}"; echo "$n $head $b" >> "$SEEN"
  done
  # Disk guard: one event when free space on / drops below 12 GiB, and one when it recovers above 16 GiB.
  free=$(df -g / | awk 'NR==2{print $4}')
  DS=/private/tmp/pantopus-tools/disk-alert.state
  if [ -n "$free" ] && [ "$free" -lt 12 ] && [ ! -f "$DS" ]; then echo "DISK LOW: ${free} GiB free on /"; touch "$DS"; fi
  if [ -n "$free" ] && [ "$free" -ge 16 ] && [ -f "$DS" ]; then echo "DISK OK again: ${free} GiB free"; rm -f "$DS"; fi
  sleep 90
done
