#!/bin/zsh
# Rerun of the mail-detail trust PR's iOS tests + install, entirely under the heavy slot (reuses ios-dd; no clean).
set -u
R=/private/tmp/pantopus-stream2-r06-runtime; W=$R/work; LOG=$W/t41-build.log
U=6F914A30-8585-4B05-9E05-94441675F10A
N=/private/tmp/pantopus-stream2-work-native
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: mail-detail iOS tests + install (rerun, reuses ios-dd)" >> $LOG 2>&1
echo "heavy slot acquired for iOS tests $(date -u +%FT%TZ) at $(git -C $N rev-parse HEAD)" >> $LOG
/private/tmp/pantopus-tools/device-slot.sh acquire "stream2: sim 6F914A30 (mail-detail trust PR)" >> $LOG 2>&1
xcrun simctl boot $U >> $LOG 2>&1; xcrun simctl bootstatus $U -b > /dev/null 2>&1
xcrun simctl uninstall $U app.pantopus.ios >> $LOG 2>&1
cd $N/frontend/apps/ios || exit 1
xcodebuild -scheme Pantopus -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd test-without-building \
  -only-testing:PantopusTests/MailDetailViewModelTests -only-testing:PantopusTests/MailDetailVariantsTests -only-testing:PantopusTests/MailTaskViewModelTests \
  -only-testing:PantopusTests/MailTaskSnapshotTests -only-testing:PantopusTests/MailDetailSnapshotTests -only-testing:PantopusTests/PartyDetailLayoutSnapshotTests > $W/t41-ios-tests.log 2>&1
echo "ios tests exit $? $(date -u +%FT%TZ)" >> $LOG
grep -E "Test Suite '.*' (passed|failed)|Executed [0-9]+ tests|error:" $W/t41-ios-tests.log | tail -12 >> $LOG
APP=$R/ios-dd/Build/Products/Debug-iphonesimulator/Pantopus.app
xcrun simctl install $U "$APP" >> $LOG 2>&1 && echo "installed $(date -u +%FT%TZ); Info.plist API $(/usr/libexec/PlistBuddy -c 'Print :PantopusAPIBaseURL' $APP/Info.plist)" >> $LOG
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "heavy slot released after iOS tests $(date -u +%FT%TZ)" >> $LOG
echo "done $(date -u +%FT%TZ)" >> $LOG
