#!/bin/zsh
# Build the Android debug APK from a worktree against the Stream 1 harness port (never :8000).
# usage: build-android.sh <worktree> <port> <logfile>
set -u
W=$1; PORT=$2; LOG=$3
cd $W/frontend/apps/android || exit 2
[ -f local.properties ] || echo "sdk.dir=/Users/yingpengwang/Library/Android/sdk" > local.properties
if [ -f .env ]; then echo "refusing: $W/frontend/apps/android/.env exists (it overrides env vars)"; exit 3; fi
PK=$(grep -E '^STRIPE_PUBLISHABLE_KEY=' /Users/yingpengwang/skinny-pantopus/backend/.env | head -1 | cut -d= -f2- | tr -d '"')
case "$PK" in pk_test_*) ;; *) echo "publishable key is not pk_test_"; exit 4;; esac
export PANTOPUS_API_BASE_URL="http://10.0.2.2:$PORT" PANTOPUS_SOCKET_URL="http://10.0.2.2:$PORT" STRIPE_PUBLISHABLE_KEY="$PK"
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream1: android assembleDebug $(git -C $W rev-parse --short HEAD)"
trap '/private/tmp/pantopus-tools/heavy-slot.sh release' EXIT
start=$(date -u +%FT%TZ)
./gradlew ktlintCheck detekt :app:assembleDebug :app:testDebugUnitTest --tests 'app.pantopus.android.ui.screens.contentdetail.ContentDetailProjectionTest' --tests 'app.pantopus.android.ui.screens.listing_offers.ListingOffersViewModelTest' --no-daemon > $LOG 2>&1
rc=$?
./gradlew --stop >/dev/null 2>&1
echo "build rc=$rc start=$start end=$(date -u +%FT%TZ)" | tee -a $LOG
APK=app/build/outputs/apk/debug/app-debug.apk
BC=$(find app/build/generated/source/buildConfig/debug -name BuildConfig.java | head -1)
echo "BuildConfig: $BC" | tee -a $LOG
grep -E "PANTOPUS_API_BASE_URL|PANTOPUS_SOCKET_URL" $BC | tee -a $LOG
if grep -q ":8000" $BC; then echo "FAIL: BuildConfig contains :8000" | tee -a $LOG; exit 5; fi
grep -q "10.0.2.2:$PORT" $BC || { echo "FAIL: port $PORT missing" | tee -a $LOG; exit 6; }
# dex string check
TMPD=$(mktemp -d); unzip -q -o $APK 'classes*.dex' -d $TMPD
if grep -a -l "10.0.2.2:8000" $TMPD/classes*.dex >/dev/null 2>&1; then echo "FAIL: dex contains 10.0.2.2:8000" | tee -a $LOG; rm -rf $TMPD; exit 7; fi
grep -a -l "10.0.2.2:$PORT" $TMPD/classes*.dex | tee -a $LOG
rm -rf $TMPD
shasum -a 256 $APK | tee -a $LOG
exit $rc
