#!/bin/zsh
# Mail-detail trust PR, second build (avatar badge commit 9acfcebf8): everything under the heavy slot, reusing ios-dd.
# iOS lint + build-for-testing + mail detail tests + install; Android ktlint/detekt, Paparazzi mail_detail (verify,
# record, verify), assemble with a dex check. Waits for work/ios-free before touching the simulator.
set -u
R=/private/tmp/pantopus-stream2-r06-runtime; W=$R/work; LOG=$W/t41-build2.log; : > $LOG; rm -f $W/ios-free
U=6F914A30-8585-4B05-9E05-94441675F10A
N=/private/tmp/pantopus-stream2-work-native
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: mail-detail trust PR rebuild (avatar badge) iOS+Android, reuses ios-dd" >> $LOG 2>&1
echo "heavy slot acquired $(date -u +%FT%TZ) at $(git -C $N rev-parse HEAD)" >> $LOG
cd $N/frontend/apps/ios || exit 1
F=Pantopus/Features/Mailbox/MailDetail/Variants/GenericMailDetailLayout.swift
swiftlint lint --strict $F >> $LOG 2>&1; echo "swiftlint exit $?" >> $LOG
swiftformat --lint $F >> $LOG 2>&1; echo "swiftformat exit $?" >> $LOG
xcodebuild -scheme Pantopus -configuration Debug -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18142 PANTOPUS_SOCKET_URL=http://127.0.0.1:18142 PANTOPUS_PUBLIC_WEB_URL=http://127.0.0.1:18144 \
  build-for-testing > $W/t41-ios-xcodebuild2.log 2>&1
echo "ios build-for-testing exit $? $(date -u +%FT%TZ)" >> $LOG; tail -1 $W/t41-ios-xcodebuild2.log >> $LOG
cd $N/frontend/apps/android || exit 1
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142 GRADLE_OPTS=-Xmx6g
run() { local name=$1; shift; echo "== $* ($(date -u +%T))" >> $LOG; ./gradlew --no-daemon "$@" > $W/t41b-gradle-$name.log 2>&1; echo "exit $? ($(date -u +%T))" >> $LOG; grep -E "BUILD (SUCCESSFUL|FAILED)|FAILED$|tests completed" $W/t41b-gradle-$name.log | tail -8 >> $LOG; }
run lint ktlintCheck detekt
run verify-before :app:verifyPaparazziDebug --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.*' --tests 'app.pantopus.android.ui.screens.mailbox.mail_task.*'
run record :app:recordPaparazziDebug --tests '*MailDetailSnapshotTest'
echo "changed after record:" >> $LOG; git -C $N status --porcelain >> $LOG
run verify-after :app:verifyPaparazziDebug --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.*' --tests 'app.pantopus.android.ui.screens.mailbox.mail_task.*'
run assemble :app:assembleDebug
APK=app/build/outputs/apk/debug/app-debug.apk
D=$(mktemp -d); (cd $D && unzip -q -o $N/frontend/apps/android/$APK 'classes*.dex')
echo "apk sha256 $(shasum -a 256 $APK | cut -d' ' -f1)" >> $LOG
echo "api urls in dex: $(for f in $D/classes*.dex; do LC_ALL=C strings -a $f | LC_ALL=C grep -a -o -E 'http://10\.0\.2\.2:[0-9]+|http://[0-9a-z.]*:8000' ; done | sort | uniq -c | tr '\n' ' ')" >> $LOG
rm -rf $D
cp $APK $W/t41-mail-trust-2.apk
echo "waiting for the simulator to be free $(date -u +%FT%TZ)" >> $LOG
until [ -e $W/ios-free ]; do sleep 5; done
cd $N/frontend/apps/ios || exit 1
xcodebuild -scheme Pantopus -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd test-without-building \
  -only-testing:PantopusTests/MailDetailViewModelTests -only-testing:PantopusTests/MailDetailVariantsTests \
  -only-testing:PantopusTests/MailDetailSnapshotTests -only-testing:PantopusTests/MailTaskSnapshotTests > $W/t41-ios-tests2.log 2>&1
echo "ios tests exit $? $(date -u +%FT%TZ)" >> $LOG
grep -E "Test Suite '.*' (passed|failed)|Executed [0-9]+ tests|error:" $W/t41-ios-tests2.log | tail -12 >> $LOG
APP=$R/ios-dd/Build/Products/Debug-iphonesimulator/Pantopus.app
xcrun simctl install $U "$APP" >> $LOG 2>&1 && echo "installed $(date -u +%FT%TZ); Info.plist API $(/usr/libexec/PlistBuddy -c 'Print :PantopusAPIBaseURL' $APP/Info.plist)" >> $LOG
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "heavy slot released $(date -u +%FT%TZ)" >> $LOG
echo "done $(date -u +%FT%TZ)" >> $LOG
