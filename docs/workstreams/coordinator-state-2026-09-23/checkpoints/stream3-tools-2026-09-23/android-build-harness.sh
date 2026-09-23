#!/bin/zsh
# android-build-harness.sh <tag>: build the LOCAL-ONLY harness APK (android-harness.patch applied, never committed) from the current
# /private/tmp/pantopus-stream3-work checkout against the owned API :18130, then revert the patch. Caller holds the heavy slot.
R=/private/tmp/pantopus-stream3-20260923-r1
TAG=${1:?tag}
W=/private/tmp/pantopus-stream3-work
cd $W || exit 1
git apply $R/android-harness.patch || exit 1
cd frontend/apps/android
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( time ./gradlew :app:assembleDebug --no-daemon -q ) > $R/android-build-$TAG-harness.log 2>&1; rc=$?
cd $W && git checkout -- frontend/apps/android/app/src/main/java/app/pantopus/android/MainActivity.kt frontend/apps/android/app/src/main/java/app/pantopus/android/core/security/StepUpCoordinator.kt
echo "exit $rc" >> $R/android-build-$TAG-harness.log
[ $rc -eq 0 ] || exit $rc
APK=$W/frontend/apps/android/app/build/outputs/apk/debug/app-debug.apk
cp -c $APK $R/android-apks/app-debug-$TAG-harness.apk
shasum -a 256 $R/android-apks/app-debug-$TAG-harness.apk | cut -d' ' -f1 > $R/android-apks/app-debug-$TAG-harness.apk.sha256
unzip -p $R/android-apks/app-debug-$TAG-harness.apk 'classes*.dex' | strings | grep -E "10\.0\.2\.2:(18130|18131|8000)" | sort | uniq -c > $R/android-apks/app-debug-$TAG-harness.portcheck.txt
git -C $W status --short | head -3
echo harness-done
