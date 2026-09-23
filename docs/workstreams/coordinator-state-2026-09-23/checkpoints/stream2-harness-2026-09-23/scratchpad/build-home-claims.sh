#!/bin/zsh
# Home trust-claims PR (claude/stream2-home-trust-claims): everything under the heavy slot, reusing ios-dd (no clean).
# iOS: lint the changed Swift files, build-for-testing (18142), the Home settings/security/hub tests, install.
# Android: ktlint/detekt, the Home settings/security/hub unit tests, Paparazzi (verify, record, verify) for
# homes.settings.* and hub.*, assemble against 10.0.2.2:18142 with a dex check.
set -u
R=/private/tmp/pantopus-stream2-r06-runtime; W=$R/work; LOG=$W/t42-build.log; : > $LOG
U=6F914A30-8585-4B05-9E05-94441675F10A
N=/private/tmp/pantopus-stream2-work-native
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: Home trust-claims iOS+Android build/tests/install (reuses ios-dd)" >> $LOG 2>&1
git -C $N checkout -q claude/stream2-home-trust-claims || { echo "checkout failed" >> $LOG; /private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1; exit 1; }
echo "heavy slot acquired $(date -u +%FT%TZ) at $(git -C $N rev-parse HEAD)" >> $LOG
cd $N/frontend/apps/ios || exit 1
F=(Pantopus/Features/Homes/Settings/HomeSettingsViewModel.swift Pantopus/Features/Homes/Settings/Security/HomeSecurityViewModel.swift
   Pantopus/Features/Hub/HubState.swift Pantopus/Features/Mailbox/Community/Components/CommunityFeedCard.swift
   PantopusTests/Features/Homes/HomeSecurityViewModelTests.swift PantopusTests/Features/Homes/HomeSettingsViewModelTests.swift)
swiftlint lint --strict $F >> $LOG 2>&1; echo "swiftlint exit $?" >> $LOG
swiftformat --lint $F >> $LOG 2>&1; echo "swiftformat exit $?" >> $LOG
xcodegen generate > /dev/null 2>&1
xcodebuild -scheme Pantopus -configuration Debug -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18142 PANTOPUS_SOCKET_URL=http://127.0.0.1:18142 PANTOPUS_PUBLIC_WEB_URL=http://127.0.0.1:18144 \
  build-for-testing > $W/t42-ios-xcodebuild.log 2>&1
echo "ios build-for-testing exit $? $(date -u +%FT%TZ)" >> $LOG; tail -1 $W/t42-ios-xcodebuild.log >> $LOG
cd $N/frontend/apps/android || exit 1
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142 GRADLE_OPTS=-Xmx6g
run() { local name=$1; shift; echo "== $* ($(date -u +%T))" >> $LOG; ./gradlew --no-daemon "$@" > $W/t42-gradle-$name.log 2>&1; echo "exit $? ($(date -u +%T))" >> $LOG; grep -E "BUILD (SUCCESSFUL|FAILED)|FAILED$|tests completed" $W/t42-gradle-$name.log | tail -6 >> $LOG; }
run lint ktlintCheck detekt
run unit :app:testDebugUnitTest --tests '*HomeSecurityViewModelTest' --tests '*HomeSettingsViewModelTest' --tests 'app.pantopus.android.ui.screens.hub.HubViewModelTest'
run verify-before :app:verifyPaparazziDebug --tests 'app.pantopus.android.ui.screens.homes.settings.*' --tests 'app.pantopus.android.ui.screens.hub.*'
run record :app:recordPaparazziDebug --tests 'app.pantopus.android.ui.screens.homes.settings.*' --tests 'app.pantopus.android.ui.screens.hub.HubSnapshotTest'
echo "changed after record:" >> $LOG; git -C $N status --porcelain >> $LOG
run verify-after :app:verifyPaparazziDebug --tests 'app.pantopus.android.ui.screens.homes.settings.*' --tests 'app.pantopus.android.ui.screens.hub.*'
run assemble :app:assembleDebug
APK=app/build/outputs/apk/debug/app-debug.apk
D=$(mktemp -d); (cd $D && unzip -q -o $N/frontend/apps/android/$APK 'classes*.dex')
echo "apk sha256 $(shasum -a 256 $APK | cut -d' ' -f1)" >> $LOG
echo "api urls in dex: $(for f in $D/classes*.dex; do LC_ALL=C strings -a $f | LC_ALL=C grep -a -o -E 'http://10\.0\.2\.2:[0-9]+|http://[0-9a-z.]*:8000' ; done | sort | uniq -c | tr '\n' ' ')" >> $LOG
rm -rf $D
cp $APK $W/t42-home-claims.apk
/private/tmp/pantopus-tools/device-slot.sh acquire "stream2: sim 6F914A30 (Home trust-claims PR)" >> $LOG 2>&1
xcrun simctl boot $U >> $LOG 2>&1; xcrun simctl bootstatus $U -b > /dev/null 2>&1
cd $N/frontend/apps/ios || exit 1
xcodebuild -scheme Pantopus -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd test-without-building \
  -only-testing:PantopusTests/HomeSecurityViewModelTests -only-testing:PantopusTests/HomeSecuritySnapshotTests \
  -only-testing:PantopusTests/HomeSettingsViewModelTests -only-testing:PantopusTests/HomeSettingsSnapshotTests \
  -only-testing:PantopusTests/HubViewModelTests > $W/t42-ios-tests.log 2>&1
echo "ios tests exit $? $(date -u +%FT%TZ)" >> $LOG
grep -E "Test Suite '.*' (passed|failed)|Executed [0-9]+ tests|error:" $W/t42-ios-tests.log | tail -12 >> $LOG
APP=$R/ios-dd/Build/Products/Debug-iphonesimulator/Pantopus.app
xcrun simctl install $U "$APP" >> $LOG 2>&1 && echo "installed $(date -u +%FT%TZ); Info.plist API $(/usr/libexec/PlistBuddy -c 'Print :PantopusAPIBaseURL' $APP/Info.plist)" >> $LOG
# Gradle rule (2026-09-23): stop daemons only while still holding the slot, before release.
(cd $N/frontend/apps/android && ./gradlew --stop >> $LOG 2>&1)
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "heavy slot released $(date -u +%FT%TZ)" >> $LOG
echo "done $(date -u +%FT%TZ)" >> $LOG
