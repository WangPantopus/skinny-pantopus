#!/bin/bash
# Usage: lint-batch.sh <tip> <multi-files list file>
# Materialises the Swift files that several PRs touch (at <tip>) with the repo's SwiftLint/SwiftFormat configs,
# then runs the pinned swiftlint --strict and swiftformat --lint on them. Exit non-zero on any violation.
set -u
TIP=$1; LIST=$2; D=$(mktemp -d /private/tmp/claude-501/lint-batch.XXXXXX)
cd /Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380 || exit 2
git show "${TIP}:frontend/apps/ios/.swiftlint.yml" > "$D/.swiftlint.yml"
git show "${TIP}:frontend/apps/ios/.swiftformat" > "$D/.swiftformat" 2>/dev/null
files=()
while read -r cnt f; do
  case "$f" in frontend/apps/ios/*.swift)
    rel=${f#frontend/apps/ios/}; mkdir -p "$D/$(dirname "$rel")"
    git show "${TIP}:$f" > "$D/$rel" 2>/dev/null && files+=("$rel");;
  esac
done < "$LIST"
[ ${#files[@]} -eq 0 ] && { echo "no shared swift files"; rm -rf "$D"; exit 0; }
cd "$D" && swiftlint lint --strict --quiet "${files[@]}"; a=$?
swiftformat --lint "${files[@]}" >/dev/null 2>&1; b=$?
echo "swiftlint=$a swiftformat=$b files=${#files[@]}"
rm -rf "$D"; [ $a -eq 0 ] && [ $b -eq 0 ]
