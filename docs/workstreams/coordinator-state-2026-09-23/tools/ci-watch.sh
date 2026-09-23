#!/bin/bash
# Emit one line per PR when its "CI OK" check completes for the PR's current head.
# PR numbers to watch: one per line in /private/tmp/pantopus-tools/ci-watch.txt (append to add).
W=/private/tmp/pantopus-tools/ci-watch.txt; SEEN=/private/tmp/pantopus-tools/ci-watch.seen
touch "$W" "$SEEN"
cd /Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380 || exit 1
while true; do
  for n in $(grep -E '^[0-9]+$' "$W" | sort -u); do
    j=$(gh pr view "$n" --json headRefOid,state 2>/dev/null) || continue
    head=$(echo "$j" | python3 -c 'import json,sys;print(json.load(sys.stdin)["headRefOid"][:9])')
    st=$(echo "$j" | python3 -c 'import json,sys;print(json.load(sys.stdin)["state"])')
    [ "$st" != "OPEN" ] && { grep -qx "$n $head $st" "$SEEN" || { echo "PR$n $st"; echo "$n $head $st" >> "$SEEN"; }; continue; }
    b=$(gh pr checks "$n" --json name,bucket 2>/dev/null | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); b=[c["bucket"] for c in d if c["name"]=="CI OK"]; print(b[0] if b else "none")
except Exception: print("err")')
    case "$b" in pass|fail|cancel)
      if ! grep -qx "$n $head $b" "$SEEN"; then
        f=$(gh pr checks "$n" --json name,bucket 2>/dev/null | python3 -c 'import json,sys
d=json.load(sys.stdin); print(",".join(c["name"] for c in d if c["bucket"] in ("fail","cancel"))[:300])')
        echo "PR$n head $head CI OK=$b ${f:+failed: $f}"; echo "$n $head $b" >> "$SEEN"
      fi;;
    esac
  done
  sleep 60
done
