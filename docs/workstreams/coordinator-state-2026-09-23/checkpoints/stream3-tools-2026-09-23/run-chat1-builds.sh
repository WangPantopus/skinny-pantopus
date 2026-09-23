#!/bin/zsh
# chat1: native chat verification claims (0db8c700c on master 1c987dcc5). iOS app + Android checks, APK and chat snapshot re-record.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: chat1 iOS + Android builds (chat verification claims)" || exit 1
cd $R
./ios-build-master-and-harness.sh chat1 > ios-build-chat1.driver.log 2>&1; echo "ios exit $?" >> ios-build-chat1.driver.log
./android-build.sh chat1 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*NewMessage*' --tests '*ChatList*' --tests '*ChatSearch*' --tests '*ChatConversation*' > android-build-chat1.driver.log 2>&1; echo "android exit $?" >> android-build-chat1.driver.log
cd /private/tmp/pantopus-stream3-work/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( ./gradlew :app:recordPaparazziDebug --tests '*ChatConversationSnapshotTest*' --tests '*ChatListSnapshotTest*' --no-daemon -q ) > $R/android-paparazzi-record-chat1.log 2>&1; echo "record exit $?" >> $R/android-paparazzi-record-chat1.log
git status --short -- app/src/test/snapshots/images >> $R/android-paparazzi-record-chat1.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
