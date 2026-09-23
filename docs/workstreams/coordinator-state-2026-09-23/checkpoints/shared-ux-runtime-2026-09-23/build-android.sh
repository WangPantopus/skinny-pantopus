#!/bin/zsh
# Usage: build-android.sh <worktree> <label>
WT="$1"; LABEL="$2"
R=/private/tmp/pantopus-shared-ux-runtime
cd "$WT/frontend/apps/android" || exit 1
[ -f local.properties ] || printf 'sdk.dir=/Users/yingpengwang/Library/Android/sdk\n' > local.properties
/private/tmp/pantopus-tools/heavy-slot.sh acquire "shared-ux: Android assembleDebug ($LABEL)"
echo "build start $(date -u +%FT%TZ) head $(git -C "$WT" rev-parse HEAD)"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18138 PANTOPUS_SOCKET_URL=http://10.0.2.2:18138 GRADLE_OPTS="-Xmx6g"
./gradlew assembleDebug --no-daemon -q > $R/gradle-$LABEL.log 2>&1
RC=$?
/private/tmp/pantopus-tools/heavy-slot.sh release
echo "build end $(date -u +%FT%TZ) rc=$RC"
tail -5 $R/gradle-$LABEL.log
APK=$(ls -t app/build/outputs/apk/debug/*.apk 2>/dev/null | head -1)
[ -n "$APK" ] || exit 1
mkdir -p $R/apk && cp "$APK" $R/apk/app-debug-$LABEL.apk
shasum -a 256 $R/apk/app-debug-$LABEL.apk
# dex check: must contain my port, must not contain :8000
unzip -p $R/apk/app-debug-$LABEL.apk 'classes*.dex' | strings | grep -E "10\.0\.2\.2:[0-9]+" | sort | uniq -c
unzip -p $R/apk/app-debug-$LABEL.apk 'classes*.dex' | strings | grep -cE '(10\.0\.2\.2|localhost|127\.0\.0\.1|192\.168\.[0-9.]+):8000' | sed 's/^/count of host:8000 URLs: /'
exit $RC
