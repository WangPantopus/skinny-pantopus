#!/bin/bash
# Every 10 min for up to ~3 h: for each PR, if its latest CI run (current head) completed as failure and the ONLY
# failed jobs are "database / Replay and lint the complete schema" (+ the CI OK aggregate), re-run failed jobs.
# Stops tracking a PR once its run succeeds or fails for another reason. Prints one line per action.
REPO=WangPantopus/skinny-pantopus; PRS="$*"
for i in $(seq 1 18); do
  left=""
  for n in $PRS; do
    sha=$(gh api "repos/$REPO/pulls/$n" --jq 'select(.state=="open") | .head.sha' 2>/dev/null)
    [ -z "$sha" ] && { echo "PR$n closed/merged, done"; continue; }
    rid=$(gh api "repos/$REPO/actions/runs?head_sha=$sha&per_page=5" --jq '[.workflow_runs[]|select(.name=="CI")][0].id' 2>/dev/null)
    read st concl <<<"$(gh api "repos/$REPO/actions/runs/$rid" --jq '"\(.status) \(.conclusion)"' 2>/dev/null)"
    if [ "$st" != "completed" ]; then left="$left $n"; continue; fi
    if [ "$concl" = "success" ]; then echo "PR$n CI success (run $rid)"; continue; fi
    other=$(gh api "repos/$REPO/actions/runs/$rid/jobs?per_page=100" --jq '[.jobs[]|select(.conclusion=="failure" or .conclusion=="cancelled")|.name|select(.!="CI OK" and .!="database / Replay and lint the complete schema")]|length' 2>/dev/null)
    if [ "$other" = "0" ]; then
      gh api -X POST "repos/$REPO/actions/runs/$rid/rerun-failed-jobs" >/dev/null 2>&1 && { sed -i '' "/^$n /d" /private/tmp/pantopus-tools/ci-watch.seen; echo "PR$n re-ran db-only failure (run $rid) $(date -u +%H:%M)"; }
      left="$left $n"
    else echo "PR$n failed for another reason too (run $rid) — needs a look"; fi
  done
  PRS="$left"; [ -z "${PRS// /}" ] && { echo "all done"; exit 0; }
  sleep 600
done
echo "gave up after 3h on:$PRS"
