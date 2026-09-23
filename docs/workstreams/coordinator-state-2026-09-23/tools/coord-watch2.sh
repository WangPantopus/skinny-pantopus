#!/bin/bash
# Combined coordinator watch: merge-queue events + CI OK results for PRs in ci-watch.txt (REST-only CI watch).
( tail -n 0 -F /private/tmp/pantopus-tools/merge-queue/log.txt | grep -E --line-buffered "MERGED|CONFLICT|CI_|TIMEOUT|CLOSED|QUEUE (EMPTY|STOP)|refused|UPDATE_FAILED" | sed -u 's/^/QUEUE /' ) &
exec /private/tmp/pantopus-tools/ci-watch2.sh
