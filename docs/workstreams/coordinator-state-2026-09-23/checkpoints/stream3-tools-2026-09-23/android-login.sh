#!/bin/bash
# android-login.sh <email> <fixture-id> <emailY> <passwordY> — types credentials on emulator-5554 without echoing the secret
export ANDROID_SERIAL=emulator-5554; ADB=$HOME/Library/Android/sdk/platform-tools/adb
EMAIL="$1"; FID="$2"; EY="$3"; PY="$4"
$ADB shell input tap 573 "$EY"; sleep 1; $ADB shell input keycombination 113 29; $ADB shell input keyevent 67
for ((i=0;i<${#EMAIL};i+=3)); do $ADB shell input text "${EMAIL:$i:3}"; sleep 0.3; done
$ADB shell input tap 520 "$PY"; sleep 1
TF=/private/tmp/pantopus-stream3-20260923-r1/throwaway-$FID.txt
if [ -f "$TF" ]; then PW=$(cat "$TF"); else PW=$(python3 -c "import json;print([x for x in json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json')) if x['id']=='$FID'][0]['password'])"); fi
for ((i=0;i<${#PW};i+=3)); do $ADB shell input text "${PW:$i:3}"; sleep 0.3; done
$ADB shell input keyevent 4; sleep 1
python3 /private/tmp/pantopus-tools/aui.py tap "Log in" 1 | tail -1
