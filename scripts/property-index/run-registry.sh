#!/usr/bin/env bash
# The workflow's build: splits every source into county partitions, then merges and publishes a state at a time, so the
# runner's small disk only ever holds one state's releases. Prints counts only.
set -euo pipefail
work="$RUNNER_TEMP/registry-work"
out="$RUNNER_TEMP/registry"
args=(--sources "$SOURCES" --work "$work" --out "$out")
[ -n "${STATES:-}" ] && args+=(--states "$STATES")
node --max-old-space-size=4096 scripts/property-index/build-registry.cjs "${args[@]}" --phase split
rm -rf "$work/nad" "$work/openaddresses"
df -h / | tail -1
states=$(node -e "
const { stateOfCounty } = require('./backend/services/propertyRecords/addressKey');
const files = require('fs').readdirSync(process.argv[1] + '/partitions');
console.log([...new Set(files.map((name) => stateOfCounty(name.slice(0, 5))))].filter(Boolean).sort().join(' '));" "$work")
all="$RUNNER_TEMP/registry-coverage"
mkdir -p "$all"
node scripts/property-index/registry-unit-truth.cjs --bucket "$PROPERTY_INDEX_BUCKET" --out "$work/unit-truth"
publishing=(--bucket "$PROPERTY_INDEX_BUCKET" --prefix index/registry --bulk --min-retention 0.97)
[ "${REPUBLISH:-false}" = "true" ] && publishing+=(--republish)
[ -n "${ACCEPT_FALLS:-}" ] && publishing+=(--accept-falls-for "$ACCEPT_FALLS")
status=0
for state in $states; do
  [ -n "${STATES:-}" ] && [[ ",$STATES," != *",$state,"* ]] && continue
  rm -rf "$out"
  node --max-old-space-size=12288 scripts/property-index/build-registry.cjs --work "$work" --out "$out" --states "$state" --phase merge
  cp "$out/coverage.json" "$all/$state.json"
  node scripts/property-index/registry-t2.cjs --out "$out" --state "$state" --truth "$work/truth" --units "$work/unit-truth" --report "$all/t2-$state.json" || status=1
  if [ "$PUBLISH" = "true" ]; then
    node --max-old-space-size=12288 scripts/property-index/registry-lineage.cjs --out "$out" --state "$state" --bucket "$PROPERTY_INDEX_BUCKET"
    node scripts/property-index/publish.cjs --out "$out" "${publishing[@]}" || status=1
  fi
done
# A run of some states leaves every other state's rows as the report published has them.
keep=()
if [ -n "${STATES:-}" ] && aws s3 cp "s3://$PROPERTY_INDEX_BUCKET/index/registry/coverage.csv" "$RUNNER_TEMP/coverage-published.csv" --only-show-errors; then
  keep=(--keep "$RUNNER_TEMP/coverage-published.csv")
fi
node scripts/property-index/registry-coverage.cjs --dir "$all" ${keep[@]+"${keep[@]}"}
node scripts/property-index/registry-t2.cjs --summary "$all"
if [ "$PUBLISH" = "true" ]; then
  aws s3 cp "$all/coverage.csv" "s3://$PROPERTY_INDEX_BUCKET/index/registry/coverage.csv" --only-show-errors
fi
exit $status
