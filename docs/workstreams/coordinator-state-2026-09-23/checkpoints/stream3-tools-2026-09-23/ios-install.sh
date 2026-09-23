#!/bin/zsh
# ios-install.sh <app-dir under ios-apps>: install under the heavy slot; release only if we acquired it
R=/private/tmp/pantopus-stream3-20260923-r1; U=0AE16FA0-E244-414F-86C8-24893BDFD979
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: iOS install $1" | tail -1 || exit 1
grep -q "stream3: iOS install $1" /private/tmp/pantopus-heavy-slot.lock/owner 2>/dev/null || { echo "slot not ours"; exit 1; }
xcrun simctl terminate $U app.pantopus.ios 2>/dev/null
xcrun simctl install $U $R/ios-apps/$1/Pantopus.app && echo "installed $1"
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
