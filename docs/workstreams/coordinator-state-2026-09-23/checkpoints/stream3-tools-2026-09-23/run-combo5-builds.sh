#!/bin/zsh
# combo5: master f02dd4bd1 + scheduling d6cdf2796 + policy b33c3294f (replaces combo3 and combo4, stopped at 17:33Z and 17:41Z).
# The heavy slot is still held from the stopped combo3 run; relabel it, build, then release.
R=/private/tmp/pantopus-stream3-20260923-r1
L=/private/tmp/pantopus-heavy-slot.lock
[ -d $L ] && grep -q '^stream3: combo[34]' $L/owner && echo "stream3: combo5 iOS + Android builds (scheduling + policy copy trust claims; replaces combo3 and combo4) | since $(date -u +%FT%TZ) | pid $$" > $L/owner
cat $L/owner
cd $R
./ios-build-master-and-harness.sh combo5 > ios-build-combo5.driver.log 2>&1; echo "ios exit $?" >> ios-build-combo5.driver.log
./android-build.sh combo5 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*Onboarding*' --tests '*PublicProfile*' --tests '*Discovery*' --tests '*Setup*' --tests '*CreatorInbox*' --tests '*HelpCenter*' --tests '*SchedulingHub*' --tests '*HubSnapshot*' > android-build-combo5.driver.log 2>&1; echo "android exit $?" >> android-build-combo5.driver.log
cd /private/tmp/pantopus-stream3-work/frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( ./gradlew :app:recordPaparazziDebug --tests '*DiscoverySnapshotTest*' --tests '*SetupSnapshotTest*' --tests '*PublicProfileSnapshotTest*' --tests '*CreatorInboxSnapshotTest*' --tests '*HelpCenter*' --tests '*.scheduling.hub.HubSnapshotTest*' --no-daemon -q ) > $R/android-paparazzi-record-combo5.log 2>&1; echo "record exit $?" >> $R/android-paparazzi-record-combo5.log
git status --short -- app/src/test/snapshots/images >> $R/android-paparazzi-record-combo5.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
