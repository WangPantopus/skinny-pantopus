#!/bin/zsh
# #325 after merging master (cce809b57): iOS lint of the two resolved files, build-for-testing (18142), the mail-task
# and vacation tests, install. Everything under the heavy slot, reusing ios-dd. Waits for work/ios-free before the
# simulator steps.
set -u
R=/private/tmp/pantopus-stream2-r06-runtime; W=$R/work; LOG=$W/t47-build.log; : > $LOG; rm -f $W/ios-free
U=6F914A30-8585-4B05-9E05-94441675F10A
N=/private/tmp/pantopus-stream2-work-native
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: #325 master-merge iOS build/tests/install (reuses ios-dd)" >> $LOG 2>&1
git -C $N checkout -q --detach cce809b5714f883404669f0af2a088380d1ac3b7 || { echo "checkout failed" >> $LOG; /private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1; exit 1; }
echo "heavy slot acquired $(date -u +%FT%TZ) at $(git -C $N rev-parse HEAD)" >> $LOG
cd $N/frontend/apps/ios || exit 1
F=(Pantopus/Features/Root/HubTabRoot.swift Pantopus/Features/Root/YouTabRoot.swift)
swiftlint lint --strict $F >> $LOG 2>&1; echo "swiftlint exit $?" >> $LOG
swiftformat --lint $F >> $LOG 2>&1; echo "swiftformat exit $?" >> $LOG
xcodegen generate > /dev/null 2>&1
xcodebuild -scheme Pantopus -configuration Debug -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18142 PANTOPUS_SOCKET_URL=http://127.0.0.1:18142 PANTOPUS_PUBLIC_WEB_URL=http://127.0.0.1:18144 \
  build-for-testing > $W/t47-ios-xcodebuild.log 2>&1
echo "ios build-for-testing exit $? $(date -u +%FT%TZ)" >> $LOG; tail -1 $W/t47-ios-xcodebuild.log >> $LOG
grep -c "warning: .*backward matching\|trailing closure" $W/t47-ios-xcodebuild.log | sed 's/^/backward-match warnings: /' >> $LOG
echo "waiting for the simulator to be free $(date -u +%FT%TZ)" >> $LOG
until [ -e $W/ios-free ]; do sleep 5; done
xcodebuild -scheme Pantopus -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd test-without-building \
  -only-testing:PantopusTests/MailTaskListViewModelTests -only-testing:PantopusTests/MailTaskViewModelTests \
  -only-testing:PantopusTests/VacationHoldViewModelTests -only-testing:PantopusTests/VacationHoldSnapshotTests > $W/t47-ios-tests.log 2>&1
echo "ios tests exit $? $(date -u +%FT%TZ)" >> $LOG
grep -E "Test Suite '.*' (passed|failed)|Executed [0-9]+ tests|error:" $W/t47-ios-tests.log | tail -12 >> $LOG
APP=$R/ios-dd/Build/Products/Debug-iphonesimulator/Pantopus.app
xcrun simctl install $U "$APP" >> $LOG 2>&1 && echo "installed $(date -u +%FT%TZ); Info.plist API $(/usr/libexec/PlistBuddy -c 'Print :PantopusAPIBaseURL' $APP/Info.plist)" >> $LOG
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "heavy slot released $(date -u +%FT%TZ)" >> $LOG
echo "done $(date -u +%FT%TZ)" >> $LOG
