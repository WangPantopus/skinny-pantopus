#!/bin/zsh
# android-build.sh <tag> [extra gradle tasks...]: Android debug build of the current /private/tmp/pantopus-stream3-work checkout against the owned API :18130
R=/private/tmp/pantopus-stream3-20260923-r1
TAG=${1:?tag}; shift
# Coordinator 18:39Z: split heavy builds under memory pressure; a HOLD file skips the build.
[ -f $R/HOLD-ANDROID ] && { echo "android build $TAG held (HOLD-ANDROID)"; exit 99; }
cd /private/tmp/pantopus-stream3-work/frontend/apps/android || exit 1
echo "head $(git rev-parse HEAD)" > $R/android-build-$TAG.head
export ANDROID_HOME=/Users/yingpengwang/Library/Android/sdk JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home GRADLE_OPTS="-Xmx5g"
export PANTOPUS_API_BASE_URL=http://10.0.2.2:18130 PANTOPUS_SOCKET_URL=http://10.0.2.2:18130 PANTOPUS_WEB_BASE_URL=http://10.0.2.2:18131
( time ./gradlew "$@" :app:assembleDebug --no-daemon -q ) > $R/android-build-$TAG.log 2>&1; rc=$?
echo "exit $rc" >> $R/android-build-$TAG.log
[ $rc -eq 0 ] || exit $rc
APK=app/build/outputs/apk/debug/app-debug.apk
mkdir -p $R/android-apks; cp -c $APK $R/android-apks/app-debug-$TAG.apk
shasum -a 256 $R/android-apks/app-debug-$TAG.apk | cut -d' ' -f1 > $R/android-apks/app-debug-$TAG.apk.sha256
# Port check: BuildConfig strings must name :18130 and never :8000
unzip -p $R/android-apks/app-debug-$TAG.apk 'classes*.dex' | strings | grep -E "10\.0\.2\.2:(18130|18131|8000)" | sort | uniq -c > $R/android-apks/app-debug-$TAG.portcheck.txt
echo done
