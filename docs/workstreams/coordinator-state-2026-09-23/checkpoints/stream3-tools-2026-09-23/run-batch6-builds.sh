#!/bin/zsh
# batch6: business profile verified claims. iOS pure build; Android Paparazzi re-record of the banner golden, then checks + APK.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: batch6 iOS + Android builds (business profile verified claims)" || exit 1
cd $R
./ios-build-master-and-harness.sh batch6 > ios-build-batch6.driver.log 2>&1; echo "ios exit $?" >> ios-build-batch6.driver.log
cd /private/tmp/pantopus-stream3-work/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
( ./gradlew :app:recordPaparazziDebug --tests '*BusinessEarnPrimitivesSnapshotTest*' --no-daemon -q ) > $R/android-paparazzi-record-batch6.log 2>&1; echo "record exit $?" >> $R/android-paparazzi-record-batch6.log
cd $R
./android-build.sh batch6 :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*MyBusinesses*' > android-build-batch6.driver.log 2>&1; echo "android exit $?" >> android-build-batch6.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
