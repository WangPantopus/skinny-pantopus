#!/bin/zsh
# Mail-detail trust PR (claude/stream2-native-mail-trust-chips): iOS lint + build-for-testing (18142) + the mailbox unit
# tests + install on my simulator; Android ktlint/detekt, the mail unit tests, Paparazzi MailTask frames
# (verify, record, verify) and an APK against 10.0.2.2:18142 with a dex check. Heavy slot for the builds; the device
# slot (already held) for the iOS tests and install.
set -u
R=/private/tmp/pantopus-stream2-r06-runtime; W=$R/work; LOG=$W/t41-build.log; : > $LOG
U=6F914A30-8585-4B05-9E05-94441675F10A
N=/private/tmp/pantopus-stream2-work-native
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: mail-detail trust PR iOS+Android build/tests" >> $LOG 2>&1
echo "heavy slot acquired $(date -u +%FT%TZ) at $(git -C $N rev-parse HEAD)" >> $LOG
cd $N/frontend/apps/ios || exit 1
echo "== swiftlint --strict (changed files)" >> $LOG
swiftlint lint --strict Pantopus/Features/Mailbox/MailTask/MailTaskView.swift Pantopus/Features/Mailbox/MailTask/Components/SourceMailCard.swift Pantopus/Features/Mailbox/MailDetail/MailDetailProjection.swift Pantopus/Features/Root/HubTabRoot.swift Pantopus/Features/Root/YouTabRoot.swift Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift >> $LOG 2>&1; echo "swiftlint exit $?" >> $LOG
swiftformat --lint Pantopus/Features/Mailbox/MailTask/MailTaskView.swift Pantopus/Features/Mailbox/MailTask/Components/SourceMailCard.swift Pantopus/Features/Mailbox/MailDetail/MailDetailProjection.swift Pantopus/Features/Root/HubTabRoot.swift Pantopus/Features/Root/YouTabRoot.swift Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift >> $LOG 2>&1; echo "swiftformat exit $?" >> $LOG
xcodegen generate > /dev/null 2>&1
xcodebuild -scheme Pantopus -configuration Debug -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18142 PANTOPUS_SOCKET_URL=http://127.0.0.1:18142 PANTOPUS_PUBLIC_WEB_URL=http://127.0.0.1:18144 \
  build-for-testing > $W/t41-ios-xcodebuild.log 2>&1
echo "ios build-for-testing exit $? $(date -u +%FT%TZ)" >> $LOG; tail -1 $W/t41-ios-xcodebuild.log >> $LOG
cd $N/frontend/apps/android || exit 1
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142 GRADLE_OPTS=-Xmx7g
run() { local name=$1; shift; echo "== $* ($(date -u +%T))" >> $LOG; ./gradlew --no-daemon "$@" > $W/t41-gradle-$name.log 2>&1; echo "exit $? ($(date -u +%T))" >> $LOG; grep -E "BUILD (SUCCESSFUL|FAILED)|FAILED$|tests completed" $W/t41-gradle-$name.log | tail -4 >> $LOG; }
run lint ktlintCheck detekt
run unit :app:testDebugUnitTest --tests '*MailDetailViewModelTest' --tests '*MailDetailVariantsTest' --tests '*MailTaskViewModelTest' --tests '*MailTaskListViewModelTest'
run verify-before :app:verifyPaparazziDebug --tests 'app.pantopus.android.ui.screens.mailbox.mail_task.*' --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.*'
run record :app:recordPaparazziDebug --tests '*MailTaskSnapshotTest' --tests '*MailDetailSnapshotTest'
echo "changed after record:" >> $LOG; git -C $N status --porcelain >> $LOG
run verify-after :app:verifyPaparazziDebug --tests 'app.pantopus.android.ui.screens.mailbox.mail_task.*' --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.*'
run assemble :app:assembleDebug
APK=app/build/outputs/apk/debug/app-debug.apk
D=$(mktemp -d); (cd $D && unzip -q -o $N/frontend/apps/android/$APK 'classes*.dex')
echo "apk sha256 $(shasum -a 256 $APK | cut -d' ' -f1)" >> $LOG
echo "api urls in dex: $(for f in $D/classes*.dex; do LC_ALL=C strings -a $f | LC_ALL=C grep -a -o -E 'http://10\.0\.2\.2:[0-9]+|http://[0-9a-z.]*:8000' ; done | sort | uniq -c | tr '\n' ' ')" >> $LOG
rm -rf $D
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "heavy slot released $(date -u +%FT%TZ)" >> $LOG
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
echo "done $(date -u +%FT%TZ)" >> $LOG
