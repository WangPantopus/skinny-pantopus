#!/bin/zsh
# Usage: build-ios-test.sh <label>  : build-for-testing the integration worktree (app + PantopusTests) into the Shared UX derived data.
LABEL="$1"
UDID=C08F0148-B19A-4DEF-80E5-5856F90169C3
DD=/private/tmp/pantopus-shared-ux-dd
cd /private/tmp/pantopus-shared-ux/frontend/apps/ios || exit 1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "shared-ux: iOS build-for-testing ($LABEL)"
echo "build start $(date -u +%FT%TZ) head $(git rev-parse HEAD)"
make bootstrap >/dev/null 2>&1
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus -configuration Debug \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath "$DD" \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18138 PANTOPUS_SOCKET_URL=http://127.0.0.1:18138 COMPILER_INDEX_STORE_ENABLE=NO \
  build-for-testing > /private/tmp/pantopus-shared-ux-runtime/xcodebuild-$LABEL.log 2>&1
RC=$?
/private/tmp/pantopus-tools/heavy-slot.sh release
echo "build end $(date -u +%FT%TZ) rc=$RC"
grep -E "error:|BUILD (SUCCEEDED|FAILED)|TEST BUILD (SUCCEEDED|FAILED)" /private/tmp/pantopus-shared-ux-runtime/xcodebuild-$LABEL.log | tail -8
APP="$DD/Build/Products/Debug-iphonesimulator/Pantopus.app"
/usr/libexec/PlistBuddy -c "Print :PantopusAPIBaseURL" "$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Print :PantopusSocketURL" "$APP/Info.plist"
exit $RC
