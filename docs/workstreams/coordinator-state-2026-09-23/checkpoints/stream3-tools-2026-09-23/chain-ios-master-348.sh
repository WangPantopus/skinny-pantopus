#!/bin/zsh
R=/private/tmp/pantopus-stream3-20260923-r1
until grep -qE "released" $R/android-build-master-348.driver.log 2>/dev/null; do sleep 5; done
cd /private/tmp/pantopus-stream3-work && [ "$(git rev-parse HEAD)" = "348ccb6382afab8c8b0af3f48f7906522828f582" ] || { echo "worktree moved: $(git rev-parse HEAD)"; exit 1; }
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: iOS pure master build 348ccb638 (#245 native tap check)" > $R/ios-build-master-348.slot.log 2>&1 && $R/ios-build-master-and-harness.sh master-348 > $R/ios-build-master-348.driver.log 2>&1
/private/tmp/pantopus-tools/heavy-slot.sh release >> $R/ios-build-master-348.driver.log 2>&1
