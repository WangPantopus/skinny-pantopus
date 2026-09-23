#!/bin/bash
# Usage: rerun-failed.sh <pr> [<pr> ...] — re-run failed jobs of the latest CI run for each PR's current head,
# and clear the watcher's recorded result so the new outcome is reported.
REPO=WangPantopus/skinny-pantopus
for n in "$@"; do
  sha=$(gh api "repos/$REPO/pulls/$n" --jq .head.sha)
  rid=$(gh api "repos/$REPO/actions/runs?head_sha=$sha&per_page=5" --jq '[.workflow_runs[]|select(.name=="CI")][0].id')
  st=$(gh api "repos/$REPO/actions/runs/$rid" --jq .status)
  if [ "$st" != "completed" ]; then echo "PR$n run $rid still $st (not re-run)"; continue; fi
  gh api -X POST "repos/$REPO/actions/runs/$rid/rerun-failed-jobs" >/dev/null && sed -i '' "/^$n /d" /private/tmp/pantopus-tools/ci-watch.seen && echo "PR$n rerun requested (run $rid) $(date -u +%H:%M:%S)"
done
