#!/bin/zsh
# cap.sh <dir> <label> : screenshot + uiautomator dump of emulator-5558
D=$1; L=$2
A=(/Users/yingpengwang/Library/Android/sdk/platform-tools/adb -s emulator-5558)
$A exec-out screencap -p > $D/screens/$L.png
ANDROID_SERIAL=emulator-5558 python3 /private/tmp/pantopus-tools/aui.py dump > $D/evidence/$L-dump.txt
echo "$L $(wc -c < $D/screens/$L.png) bytes, $(wc -l < $D/evidence/$L-dump.txt) nodes"
