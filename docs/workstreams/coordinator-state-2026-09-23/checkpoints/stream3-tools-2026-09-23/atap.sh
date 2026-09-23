#!/bin/zsh
# atap.sh <x> <y> (in 1/3-scale screenshot coordinates) → adb tap on emulator-5554 at full resolution
$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell input tap $(( $1 * 3 )) $(( $2 * 3 ))
