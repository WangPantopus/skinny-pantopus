#!/bin/zsh
# Waits for the heavy slot, boots emulator-5558 under a device slot, installs the given APK, then releases the heavy slot.
set -u
APK=$1; LABEL=$2; SP=$(dirname $0); A=/Users/yingpengwang/Library/Android/sdk/platform-tools/adb
TMPD=$(mktemp -d); unzip -q -o $APK 'classes*.dex' -d $TMPD
if grep -a -l "10.0.2.2:8000" $TMPD/classes*.dex >/dev/null 2>&1; then echo "REFUSE: dex contains 10.0.2.2:8000"; rm -rf $TMPD; exit 7; fi
grep -a -q "10.0.2.2:18132" $TMPD/classes*.dex || { echo "REFUSE: dex lacks 10.0.2.2:18132"; rm -rf $TMPD; exit 6; }
rm -rf $TMPD
echo "apk $(shasum -a 256 $APK | cut -c1-64) checked: has 10.0.2.2:18132, no :8000"
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream1: emulator boot + adb install $LABEL" | grep -v "heavy slot busy\|memory pressure"
trap '/private/tmp/pantopus-tools/heavy-slot.sh release' EXIT
/private/tmp/pantopus-tools/device-slot.sh acquire "stream1: android emulator-5558 (Pantopus_Stream1_Start_R2) afters $LABEL" | grep -v "busy"
(/Users/yingpengwang/Library/Android/sdk/emulator/emulator -avd Pantopus_Stream1_Start_R2 -port 5558 -no-window -no-audio -no-boot-anim -no-snapshot-save > $SP/emulator-5558-g.log 2>&1 &)
for i in $(seq 1 90); do s=$($A -s emulator-5558 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r'); [ "$s" = "1" ] && { echo "booted at $(date -u +%H:%M:%SZ)"; break; }; sleep 4; done
sleep 15
$A -s emulator-5558 install -r $APK 2>&1 | tail -2
echo "installed at $(date -u +%FT%TZ)"
