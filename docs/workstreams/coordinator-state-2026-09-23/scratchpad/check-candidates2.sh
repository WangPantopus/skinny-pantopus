#!/bin/bash
# For each PR: READY if CI OK passed on the current head, or the latest CI run failed ONLY the database replay job
# (ghcr outage; batch CI re-checks it). Also flags heads that changed since review (refs/remotes/pr/N).
REPO=WangPantopus/skinny-pantopus
cd /Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380 || exit 1
for n in "$@"; do
  read st merged base sha <<<"$(gh api "repos/$REPO/pulls/$n" --jq '"\(.state) \(.merged) \(.base.ref) \(.head.sha)"' 2>/dev/null)"
  [ "$merged" = "true" ] && { echo "MERGED $n"; continue; }
  [ "$st" != "open" ] && { echo "CLOSED $n"; continue; }
  rid=$(gh api "repos/$REPO/actions/runs?head_sha=$sha&per_page=5" --jq '[.workflow_runs[]|select(.name=="CI")][0].id' 2>/dev/null)
  read rst rconcl <<<"$(gh api "repos/$REPO/actions/runs/$rid" --jq '"\(.status) \(.conclusion)"' 2>/dev/null)"
  reviewed=$(git rev-parse -q --verify "refs/remotes/pr/$n" 2>/dev/null)
  chg=""; [ -n "$reviewed" ] && [ "$reviewed" != "$sha" ] && chg=" CHANGED-SINCE-REVIEW(${reviewed:0:9})"
  if [ "$rst" != "completed" ]; then echo "NOTREADY $n ${sha:0:9} ci=$rst base=$base$chg"; continue; fi
  if [ "$rconcl" = "success" ]; then echo "READY $n $sha base=$base$chg"; continue; fi
  other=$(gh api "repos/$REPO/actions/runs/$rid/jobs?per_page=100" --jq '[.jobs[]|select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out")|.name|select(.!="CI OK" and .!="database / Replay and lint the complete schema")]|join(",")' 2>/dev/null)
  if [ -z "$other" ]; then echo "READY $n $sha base=$base (db-only failure)$chg"; else echo "NOTREADY $n ${sha:0:9} failed=$other base=$base$chg"; fi
done
