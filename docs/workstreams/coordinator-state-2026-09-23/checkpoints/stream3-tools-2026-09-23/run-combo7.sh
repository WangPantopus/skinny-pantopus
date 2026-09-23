#!/bin/zsh
# combo7: master f02dd4bd1 + scheduling/you e7d72161a (hub business pill, live preview, onboarding tz copy). iOS then Android, slot released between.
R=/private/tmp/pantopus-stream3-20260923-r1
W=/private/tmp/pantopus-stream3-work
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: combo7 iOS build (scheduling hub business pill + preview)" || exit 1
cd $R
./ios-build-master-and-harness.sh combo7 > ios-build-combo7.driver.log 2>&1; echo "ios exit $?" >> ios-build-combo7.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: combo7 Android checks + APK + Paparazzi record" || exit 1
./android-build.sh combo7 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*SchedulingHub*' --tests '*.scheduling.hub.HubSnapshotTest*' --tests '*Setup*' --tests '*Onboarding*' --tests '*Discovery*' > android-build-combo7.driver.log 2>&1; echo "android exit $?" >> android-build-combo7.driver.log
cd $W/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( ./gradlew :app:recordPaparazziDebug --tests '*SetupSnapshotTest*' --tests '*.scheduling.hub.HubSnapshotTest*' --no-daemon -q ) > $R/android-paparazzi-record-combo7.log 2>&1; echo "record exit $?" >> $R/android-paparazzi-record-combo7.log
git status --short -- app/src/test/snapshots/images >> $R/android-paparazzi-record-combo7.log
./gradlew --stop >> $R/android-paparazzi-record-combo7.log 2>&1
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
