#!/bin/zsh
# android-install.sh <apk> <label> : install an APK on emulator-5558 under the heavy slot, after re-checking its API strings.
set -u
APK=$1; LABEL=$2; A=/Users/yingpengwang/Library/Android/sdk/platform-tools/adb
TMPD=$(mktemp -d); unzip -q -o $APK 'classes*.dex' -d $TMPD
if grep -a -l "10.0.2.2:8000" $TMPD/classes*.dex >/dev/null 2>&1; then echo "REFUSE: dex contains 10.0.2.2:8000"; rm -rf $TMPD; exit 7; fi
grep -a -q "10.0.2.2:18132" $TMPD/classes*.dex || { echo "REFUSE: dex lacks 10.0.2.2:18132"; rm -rf $TMPD; exit 6; }
rm -rf $TMPD
echo "apk $(shasum -a 256 $APK | cut -c1-64) checked: has 10.0.2.2:18132, no :8000"
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream1: adb install $LABEL"
trap '/private/tmp/pantopus-tools/heavy-slot.sh release' EXIT
$A -s emulator-5558 install -r $APK 2>&1 | tail -2
echo "installed at $(date -u +%FT%TZ)"
