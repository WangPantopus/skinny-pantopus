#!/bin/zsh
# #346 CI fix: re-record the Earn empty and Mail > Earn drawer empty Paparazzi frames, then verify, in the heavy slot.
set -u
W=/private/tmp/pantopus-stream2-r06-runtime/work
LOG=$W/t37-paparazzi.log
: > $LOG
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: Android Paparazzi re-record for #346 (Earn frames)" >> $LOG 2>&1
echo "slot acquired $(date -u +%FT%TZ) at $(git -C /private/tmp/pantopus-stream2-work-native rev-parse --short HEAD)" >> $LOG
cd /private/tmp/pantopus-stream2-work-native/frontend/apps/android || exit 1
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142 GRADLE_OPTS=-Xmx7g
run() { local name=$1; shift; echo "== $* ($(date -u +%T))" >> $LOG; ./gradlew --no-daemon "$@" > $W/t37-gradle-$name.log 2>&1; echo "exit $? ($(date -u +%T))" >> $LOG; tail -4 $W/t37-gradle-$name.log >> $LOG; }
run verify-before :app:verifyPaparazziDebug --tests '*EarnSnapshotTest' --tests '*MailboxRootSnapshotTest'
run record :app:recordPaparazziDebug --tests '*EarnSnapshotTest' --tests '*MailboxRootSnapshotTest'
echo "changed after record:" >> $LOG; git -C /private/tmp/pantopus-stream2-work-native status --porcelain >> $LOG
run verify-after :app:verifyPaparazziDebug --tests '*EarnSnapshotTest' --tests '*MailboxRootSnapshotTest'
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "slot released $(date -u +%FT%TZ)" >> $LOG
echo "done" >> $LOG
