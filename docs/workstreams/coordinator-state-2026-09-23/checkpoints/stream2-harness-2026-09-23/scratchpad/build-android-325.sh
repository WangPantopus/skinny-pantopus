#!/bin/zsh
# Android checks + debug APK for the grouped #325 head against my API (10.0.2.2:18142), in the heavy slot.
set -u
W=/private/tmp/pantopus-stream2-r06-runtime/work
LOG=$W/t34-android-build.log
: > $LOG
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: Android checks + APK (#325 grouped: 409, replay, vacation) against 18142" >> $LOG 2>&1
echo "slot acquired $(date -u +%FT%TZ) at $(git -C /private/tmp/pantopus-stream2-work-native rev-parse --short HEAD) (+ working tree)" >> $LOG
cd /private/tmp/pantopus-stream2-work-native/frontend/apps/android || exit 1
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142 GRADLE_OPTS=-Xmx7g
run() { echo "== $* ($(date -u +%T))" >> $LOG; ./gradlew --no-daemon "$@" > $W/t34-gradle-$1.log 2>&1; echo "exit $? ($(date -u +%T))" >> $LOG; grep -E "BUILD (SUCCESSFUL|FAILED)" $W/t34-gradle-$1.log | tail -1 >> $LOG; }
run ktlintCheck detekt
run :app:testDebugUnitTest --tests '*VacationHold*' --tests '*MailTaskList*' --tests '*FutureDate*'
run :app:verifyPaparazziDebug --tests '*VacationHoldSnapshotTest' --tests '*MailTask*'
run :app:assembleDebug
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "slot released $(date -u +%FT%TZ)" >> $LOG
APK=app/build/outputs/apk/debug/app-debug.apk
D=$(mktemp -d); (cd $D && unzip -q -o /private/tmp/pantopus-stream2-work-native/frontend/apps/android/$APK 'classes*.dex')
echo "apk sha256 $(shasum -a 256 $APK | cut -d' ' -f1)" >> $LOG
echo "api urls in dex: $(for f in $D/classes*.dex; do LC_ALL=C strings -a $f | LC_ALL=C grep -a -o -E 'http://[0-9a-z.]+:[0-9]+' ; done | sort | uniq -c | tr '\n' ' ')" >> $LOG
rm -rf $D
echo "done $(date -u +%FT%TZ)" >> $LOG
