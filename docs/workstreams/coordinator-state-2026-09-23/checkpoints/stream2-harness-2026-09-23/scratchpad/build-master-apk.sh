#!/bin/zsh
# Build a master baseline APK (same env as the fix build) for the native notification-link reproduction.
set -u
S=/private/tmp/claude-501/-Users-yingpengwang-estimate-rescue-skinny-pantopus-pantopus-stream-2-home-3ef380/92cc4526-97b8-4557-9ce8-edb8d94d4d5a/scratchpad
W=/private/tmp/pantopus-stream2-work-native
LOG=$S/build-master-apk.log
: > $LOG
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: Android master baseline build (notification-link repro) against 18142" >> $LOG 2>&1
echo "slot acquired $(date -u +%FT%TZ)" >> $LOG
cd $W || exit 1
git fetch -q origin
MASTER=$(git rev-parse origin/master)
echo "master $MASTER" >> $LOG
git checkout -q --detach "$MASTER" >> $LOG 2>&1 || { echo "checkout failed" >> $LOG; /private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG; exit 1; }
cd frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk PANTOPUS_API_BASE_URL=http://10.0.2.2:18142 PANTOPUS_SOCKET_URL=http://10.0.2.2:18142
./gradlew --no-daemon -q :app:assembleDebug >> $LOG 2>&1
echo "gradle exit $? $(date -u +%FT%TZ)" >> $LOG
mkdir -p $S/apks && cp app/build/outputs/apk/debug/app-debug.apk $S/apks/master-${MASTER:0:9}.apk
cd $W && git checkout -q claude/stream2-native-notification-links-build >> $LOG 2>&1
echo "worktree back on $(git branch --show-current) $(git rev-parse --short HEAD)" >> $LOG
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
mkdir -p $S/apkchk-m && cd $S/apkchk-m && unzip -q -o $S/apks/master-${MASTER:0:9}.apk 'classes*.dex'
echo "master apk sha256 $(shasum -a 256 $S/apks/master-${MASTER:0:9}.apk | cut -d' ' -f1)" >> $LOG
echo "urls: $(for f in classes*.dex; do LC_ALL=C strings -a $f | LC_ALL=C grep -a -o 'http://10\.0\.2\.2:[0-9]*'; done | sort | uniq -c | tr '\n' ' ')" >> $LOG
cd $S && rm -rf apkchk-m
echo "done $(date -u +%FT%TZ)" >> $LOG
