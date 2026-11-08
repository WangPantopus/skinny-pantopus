#!/usr/bin/env bash
# The workflow's build, one job per group of states (registry-groups.cjs): splits every source into county partitions, then
# merges and publishes a state at a time, so the runner's small disk only ever holds one state's releases. Each state's counts
# go to $RUNNER_TEMP/registry-coverage; `run-registry.sh report`, after every group, turns them into the coverage report and
# T2's summary. Prints counts only.
set -euo pipefail
work="$RUNNER_TEMP/registry-work"
out="$RUNNER_TEMP/registry"
all="$RUNNER_TEMP/registry-coverage"
if [ "${1:-build}" = "report" ]; then
  # A state no group reached (or one with no addresses) keeps the rows the report published has for it.
  keep=()
  if aws s3 cp "s3://$PROPERTY_INDEX_BUCKET/index/registry/coverage.csv" "$RUNNER_TEMP/coverage-published.csv" --only-show-errors; then
    keep=(--keep "$RUNNER_TEMP/coverage-published.csv")
  fi
  mkdir -p "$all"
  node scripts/property-index/registry-coverage.cjs --dir "$all" ${keep[@]+"${keep[@]}"}
  node scripts/property-index/registry-t2.cjs --summary "$all"
  if [ "$PUBLISH" = "true" ]; then
    aws s3 cp "$all/coverage.csv" "s3://$PROPERTY_INDEX_BUCKET/index/registry/coverage.csv" --only-show-errors
  fi
  exit 0
fi
args=(--sources "$SOURCES" --work "$work" --out "$out")
truth=(--bucket "$PROPERTY_INDEX_BUCKET" --out "$work/unit-truth")
if [ -n "${STATES:-}" ]; then
  args+=(--states "$STATES")
  truth+=(--states "$STATES")
fi
node --max-old-space-size=4096 scripts/property-index/build-registry.cjs "${args[@]}" --phase split
rm -rf "$work/nad" "$work/openaddresses"
df -h / | tail -1
states=$(node -e "
const { stateOfCounty } = require('./backend/services/propertyRecords/addressKey');
const files = require('fs').readdirSync(process.argv[1] + '/partitions');
console.log([...new Set(files.map((name) => stateOfCounty(name.slice(0, 5))))].filter(Boolean).sort().join(' '));" "$work")
mkdir -p "$all"
node scripts/property-index/registry-unit-truth.cjs "${truth[@]}"
publishing=(--bucket "$PROPERTY_INDEX_BUCKET" --prefix index/registry --bulk --min-retention 0.97)
lineage=(--bucket "$PROPERTY_INDEX_BUCKET")
if [ "${REPUBLISH:-false}" = "true" ]; then
  publishing+=(--republish)
  lineage+=(--republish)
fi
[ -n "${ACCEPT_FALLS:-}" ] && publishing+=(--accept-falls-for "$ACCEPT_FALLS")
status=0
for state in $states; do
  [ -n "${STATES:-}" ] && [[ ",$STATES," != *",$state,"* ]] && continue
  rm -rf "$out"
  node --max-old-space-size=12288 scripts/property-index/build-registry.cjs --work "$work" --out "$out" --states "$state" --phase merge
  cp "$out/coverage.json" "$all/$state.json"
  node scripts/property-index/registry-t2.cjs --out "$out" --state "$state" --truth "$work/truth" --units "$work/unit-truth" --report "$all/t2-$state.json" || status=1
  if [ "$PUBLISH" = "true" ]; then
    node --max-old-space-size=12288 scripts/property-index/registry-lineage.cjs --out "$out" --state "$state" "${lineage[@]}"
    node scripts/property-index/publish.cjs --out "$out" "${publishing[@]}" || status=1
  fi
done
exit $status
