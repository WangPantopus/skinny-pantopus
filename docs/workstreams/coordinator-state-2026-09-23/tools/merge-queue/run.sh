#!/bin/zsh
# Serial exact-head merge queue for WangPantopus/skinny-pantopus (coordinator-reviewed PRs only).
# Reads the next PR number from $Q/queue.txt (one per line; append to add). Logs one line per event to $Q/log.txt.
Q=/private/tmp/pantopus-tools/merge-queue
cd /Users/yingpengwang/skinny-pantopus
log(){ echo "$(date -u +%H:%M:%S) $*" >> $Q/log.txt; }
log "QUEUE START"
while true; do
  n=$(grep -m1 -E '^[0-9]+$' $Q/queue.txt 2>/dev/null)
  [ -z "$n" ] && { log "QUEUE EMPTY"; break; }
  deadline=$(( $(date +%s) + 14400 )); outcome=""; lastci=""
  while [ $(date +%s) -lt $deadline ]; do
    j=$(gh pr view $n --json state,mergeStateStatus,headRefOid 2>/dev/null) || { sleep 30; continue; }
    st=$(echo $j | python3 -c 'import json,sys;print(json.load(sys.stdin)["state"])')
    ms=$(echo $j | python3 -c 'import json,sys;print(json.load(sys.stdin)["mergeStateStatus"])')
    head=$(echo $j | python3 -c 'import json,sys;print(json.load(sys.stdin)["headRefOid"])')
    [ "$st" = "MERGED" ] && { outcome="ALREADY_MERGED"; break; }
    [ "$st" = "CLOSED" ] && { outcome="CLOSED"; break; }
    if [ "$ms" = "BEHIND" ]; then
      gh pr update-branch $n >/dev/null 2>&1 && { log "PR$n updated (was ${head:0:9})"; sleep 25; continue; } || { outcome="UPDATE_FAILED_CONFLICT"; break; }
    fi
    [ "$ms" = "DIRTY" ] && { outcome="CONFLICT"; break; }
    ci=$(gh pr checks $n --json name,bucket 2>/dev/null | python3 -c 'import json,sys
d=json.load(sys.stdin); b=[c["bucket"] for c in d if c["name"]=="CI OK"]; print(b[0] if b else "none")' 2>/dev/null)
    # A failed or cancelled CI OK is logged once and the PR stays at the head of the queue: flaky jobs (registry
    # rate limits) are re-run by the coordinator, and a real failure is removed from queue.txt by hand.
    if [ "$ci" = "fail" ] || [ "$ci" = "cancel" ]; then
      [ "$lastci" != "$head:$ci" ] && log "PR$n CI_$ci at ${head:0:9} (waiting for a re-run or removal)"
      lastci="$head:$ci"
    fi
    if [ "$ci" = "pass" ] && { [ "$ms" = "CLEAN" ] || [ "$ms" = "UNSTABLE" ] || [ "$ms" = "HAS_HOOKS" ]; }; then
      if gh pr merge $n --merge --match-head-commit $head >/dev/null 2>&1; then
        sleep 5; mc=$(gh pr view $n --json mergeCommit -q .mergeCommit.oid 2>/dev/null); outcome="MERGED ${head:0:9} -> ${mc:0:9}"; break
      else log "PR$n merge attempt refused at ${head:0:9} (retrying)"; fi
    fi
    sleep 45
  done
  [ -z "$outcome" ] && outcome="TIMEOUT"
  log "PR$n $outcome"
  python3 - "$Q/queue.txt" "$n" <<'PY'
import sys
p,n=sys.argv[1],sys.argv[2]
lines=open(p).read().split('\n'); out=[]; removed=False
for l in lines:
    if not removed and l.strip()==n: removed=True; continue
    out.append(l)
open(p,'w').write('\n'.join(out))
PY
done
log "QUEUE STOP"
