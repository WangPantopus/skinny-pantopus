#!/bin/bash
# Usage: build-batch.sh <base-ref> <out-file> <pr numbers...>
# Builds a chain of merge commits (base + each PR head, in order) in the object store only.
set -u
base=$(git rev-parse "$1"); out=$2; shift 2
cur=$base; : > "$out"
for n in "$@"; do
  head=$(git rev-parse "refs/remotes/pr/$n")
  title=$(gh api "repos/WangPantopus/skinny-pantopus/pulls/$n" --jq .title)
  res=$(git merge-tree --write-tree --no-messages "$cur" "$head" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then
    files=$(git merge-tree --write-tree --name-only "$cur" "$head" 2>/dev/null | sed -n '2,/^$/p' | grep . | tr '\n' ' ')
    echo "SKIP $n ${head:0:9} conflict: $files" | tee -a "$out"; continue
  fi
  tree=$(echo "$res" | head -1)
  msg=$(printf 'Merge PR #%s: %s\n\nHead %s, merged unchanged as part of a combined merge.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n' "$n" "$title" "$head")
  cur=$(git commit-tree "$tree" -p "$cur" -p "$head" -m "$msg")
  echo "OK $n $head $cur" | tee -a "$out"
done
echo "TIP $cur" | tee -a "$out"
