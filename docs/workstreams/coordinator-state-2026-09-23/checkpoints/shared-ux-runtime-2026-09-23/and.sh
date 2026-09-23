#!/bin/bash
# and.sh install <apk> | dump <name> | tap <text> [n] | shot <name> | type <text> | key <code> | launch | stop | clear
export ANDROID_SERIAL=emulator-5570
ADB=~/Library/Android/sdk/platform-tools/adb
R=/private/tmp/pantopus-shared-ux-runtime
A=/private/tmp/pantopus-tools/aui.py
PKG=app.pantopus.android.debug
mkdir -p $R/andshots
case "$1" in
  install)
    /private/tmp/pantopus-tools/heavy-slot.sh acquire "shared-ux: adb install $(basename "$2") on emulator-5570" >/dev/null
    $ADB install -r "$2" 2>&1 | tail -1
    /private/tmp/pantopus-tools/heavy-slot.sh release >/dev/null; echo "installed at $(date -u +%FT%TZ)";;
  dump) python3 $A dump > $R/andshots/$2.txt; cat $R/andshots/$2.txt;;
  tap) python3 $A tap "$2" ${3:-0};;
  shot) python3 $A shot $R/andshots/$2.png >/dev/null && sips -Z 700 $R/andshots/$2.png --out $R/andshots/$2-small.png >/dev/null && echo $R/andshots/$2-small.png;;
  type) s="$2"; for ((i=0;i<${#s};i++)); do c="${s:$i:1}"; case "$c" in " ") c="%s";; "@") c="\@";; esac; $ADB shell input text "$c"; sleep 0.15; done;;
  key) $ADB shell input keyevent "$2";;
  launch) $ADB shell am start -n $PKG/app.pantopus.android.MainActivity >/dev/null 2>&1; echo launched;;
  stop) $ADB shell am force-stop $PKG;;
  clear) $ADB shell pm clear $PKG;;
esac
