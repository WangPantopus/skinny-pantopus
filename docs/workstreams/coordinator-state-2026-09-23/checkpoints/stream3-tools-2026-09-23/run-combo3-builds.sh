#!/bin/zsh
# combo3: master f02dd4bd1 + scheduling 831c8bc47b + policy b33c3294f0. iOS app + Android checks, APK and discovery snapshot re-record.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: combo3 iOS + Android builds (scheduling + policy copy trust claims)" || exit 1
cd $R
./ios-build-master-and-harness.sh combo3 > ios-build-combo3.driver.log 2>&1; echo "ios exit $?" >> ios-build-combo3.driver.log
./android-build.sh combo3 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*Onboarding*' --tests '*PublicProfile*' --tests '*Discovery*' --tests '*Setup*' --tests '*CreatorInbox*' --tests '*HelpCenter*' > android-build-combo3.driver.log 2>&1; echo "android exit $?" >> android-build-combo3.driver.log
cd /private/tmp/pantopus-stream3-work/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( ./gradlew :app:recordPaparazziDebug --tests '*DiscoverySnapshotTest*' --tests '*SetupSnapshotTest*' --tests '*PublicProfileSnapshotTest*' --tests '*CreatorInboxSnapshotTest*' --no-daemon -q ) > $R/android-paparazzi-record-combo3.log 2>&1; echo "record exit $?" >> $R/android-paparazzi-record-combo3.log
git status --short -- app/src/test/snapshots/images >> $R/android-paparazzi-record-combo3.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
