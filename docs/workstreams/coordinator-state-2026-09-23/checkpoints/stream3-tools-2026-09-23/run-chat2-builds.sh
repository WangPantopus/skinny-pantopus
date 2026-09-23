#!/bin/zsh
# chat2: native chat verification claims (bc945cf1c on master 1c987dcc5). iOS app + Android checks, APK and chat snapshot re-record.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: chat2 iOS + Android builds (chat verification claims)" || exit 1
cd $R
./ios-build-master-and-harness.sh chat2 > ios-build-chat2.driver.log 2>&1; echo "ios exit $?" >> ios-build-chat2.driver.log
./android-build.sh chat2 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*NewMessage*' --tests '*ChatList*' --tests '*ChatSearch*' --tests '*ChatConversation*' --tests '*Connections*' --tests '*PublicProfile*' > android-build-chat2.driver.log 2>&1; echo "android exit $?" >> android-build-chat2.driver.log
cd /private/tmp/pantopus-stream3-work/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( ./gradlew :app:verifyPaparazziDebug --tests '*ChatConversationSnapshotTest*' --tests '*ChatListSnapshotTest*' --no-daemon -q ) > $R/android-paparazzi-verify-chat2.log 2>&1; echo "verify exit $?" >> $R/android-paparazzi-verify-chat2.log
git status --short -- app/src/test/snapshots/images >> $R/android-paparazzi-verify-chat2.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
