#!/bin/zsh
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: batch5c Android ktlint (no cache) + build" || exit 1
cd /private/tmp/pantopus-stream3-work/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( ./gradlew :app:ktlintCheck --no-build-cache --rerun-tasks --no-daemon -q ) > $R/android-ktlint-batch5c.log 2>&1; echo "ktlint exit $?" >> $R/android-ktlint-batch5c.log
cd $R
./android-build.sh batch5 :app:detekt :app:testDebugUnitTest --tests '*PrivacyViewModelTest*' --tests '*SettingsViewModelsTest*' > android-build-batch5.driver.log 2>&1; echo "android exit $?" >> android-build-batch5.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
