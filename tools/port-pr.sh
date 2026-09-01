#!/usr/bin/env bash
# Port a WangPantopus/pantopus PR into this repo's working tree.
# Usage: tools/port-pr.sh <pr-number>
set -euo pipefail
PR="$1"
SRC="git@github-second:WangPantopus/pantopus.git"
OUT="/tmp/pr-$PR.patch"

# 1. Branch name (strip the CR that gh sometimes appends)
BRANCH=$(gh pr view "$PR" --repo WangPantopus/pantopus --json headRefName -q .headRefName | tr -d '\r')
echo "PR $PR → branch $BRANCH"

# 2. Fetch the branch and the old master as objects (no history merge)
git fetch -q "$SRC" "master:refs/remotes/pantopus/master" "$BRANCH:refs/remotes/pantopus/pr$PR"

# 3. Full diff of the PR against the point it branched from
BASE=$(git merge-base pantopus/master "pantopus/pr$PR")
git diff --binary "$BASE" "pantopus/pr$PR" > "$OUT"
echo "base: $(git log --oneline -1 "$BASE")"

# 4. Already here? (reverse patch applies cleanly ⇒ nothing to do)
if git apply --check -R "$OUT" >/dev/null 2>&1; then
  echo "Already present in this tree. Nothing to apply."; exit 0
fi

# 5. Apply with a three-way merge; conflicts get markers instead of failing
git apply --3way "$OUT" || true
# git's U-status misses files whose hunks fell back to direct application,
# so look for the markers themselves.
CONFLICTS=$(grep -rl '^<<<<<<< ' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.swift' \
  --include='*.kt' --include='*.json' --include='*.sql' --include='*.yml' --include='*.md' \
  backend frontend pantopus-seeder supabase tools docs 2>/dev/null || true)
if [ -n "$CONFLICTS" ]; then
  echo "Resolve conflict markers in:"; echo "$CONFLICTS"
  echo "Then: re-run this grep until it is empty, run the tests, commit, push."
else
  echo "Applied cleanly. Run the tests, then commit and push."
fi
