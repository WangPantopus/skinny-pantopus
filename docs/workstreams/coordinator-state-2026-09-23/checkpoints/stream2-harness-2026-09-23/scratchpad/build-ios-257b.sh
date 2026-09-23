#!/bin/zsh
# #257 after merging master f02dd4bd1: iOS build-for-testing against my API (18142), the routing unit tests on my
# simulator 6F914A30, then leave the fresh app installed for the notification-link tap check. Android DeepLinkRouterTest.
set -u
R=/private/tmp/pantopus-stream2-r06-runtime; W=$R/work; LOG=$W/t40-257.log; : > $LOG
U=6F914A30-8585-4B05-9E05-94441675F10A
N=/private/tmp/pantopus-stream2-work-native
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: #257 iOS build-for-testing + Android router test" >> $LOG 2>&1
echo "heavy slot acquired $(date -u +%FT%TZ) at $(git -C $N rev-parse HEAD)" >> $LOG
cd $N/frontend/apps/ios || exit 1
xcodegen generate >> $LOG 2>&1
xcodebuild -scheme Pantopus -configuration Debug -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18142 PANTOPUS_SOCKET_URL=http://127.0.0.1:18142 PANTOPUS_PUBLIC_WEB_URL=http://127.0.0.1:18144 \
  build-for-testing > $W/t40-ios-xcodebuild.log 2>&1
echo "build-for-testing exit $? $(date -u +%FT%TZ)" >> $LOG
tail -2 $W/t40-ios-xcodebuild.log >> $LOG
cd $N/frontend/apps/android || exit 1
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142 GRADLE_OPTS=-Xmx7g
./gradlew --no-daemon :app:testDebugUnitTest --tests '*DeepLinkRouterTest' > $W/t40-android-router-test.log 2>&1
echo "android DeepLinkRouterTest exit $? $(date -u +%FT%TZ)" >> $LOG
tail -3 $W/t40-android-router-test.log >> $LOG
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "heavy slot released $(date -u +%FT%TZ)" >> $LOG
/private/tmp/pantopus-tools/device-slot.sh acquire "stream2: sim 6F914A30 (#257 re-check)" >> $LOG 2>&1
xcrun simctl boot $U >> $LOG 2>&1; xcrun simctl bootstatus $U -b > /dev/null 2>&1
xcrun simctl uninstall $U app.pantopus.ios >> $LOG 2>&1
cd $N/frontend/apps/ios || exit 1
xcodebuild -scheme Pantopus -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd test-without-building \
  -only-testing:PantopusTests/DeepLinkRouterTests -only-testing:PantopusTests/DeepLinkRouterPlaceTests -only-testing:PantopusTests/DeepLinkDiagnosticsTests \
  -only-testing:PantopusTests/HubRouteTests -only-testing:PantopusTests/HomeTaskNotificationRoutingTests -only-testing:PantopusTests/HomeTaskNotificationTapTests \
  -only-testing:PantopusTests/PlaceArrivalTests -only-testing:PantopusTests/NotificationsViewModelTests > $W/t40-ios-tests.log 2>&1
echo "ios routing tests exit $? $(date -u +%FT%TZ)" >> $LOG
grep -E "Test Suite '.*' (passed|failed)|Executed [0-9]+ tests" $W/t40-ios-tests.log | tail -20 >> $LOG
APP=$(find $R/ios-dd/Build/Products/Debug-iphonesimulator -maxdepth 1 -name "Pantopus.app" | head -1)
xcrun simctl boot $U >> $LOG 2>&1; xcrun simctl bootstatus $U -b > /dev/null 2>&1
xcrun simctl install $U "$APP" >> $LOG 2>&1 && echo "installed $APP $(date -u +%FT%TZ)" >> $LOG
/usr/libexec/PlistBuddy -c "Print :PantopusAPIBaseURL" "$APP/Info.plist" >> $LOG 2>&1
echo "done $(date -u +%FT%TZ) (device slot still held for the tap check)" >> $LOG
