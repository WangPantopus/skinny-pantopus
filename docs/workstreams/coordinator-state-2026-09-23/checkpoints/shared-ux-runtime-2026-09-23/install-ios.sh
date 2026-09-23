#!/bin/zsh
U=C08F0148-B19A-4DEF-80E5-5856F90169C3
/private/tmp/pantopus-tools/heavy-slot.sh acquire "shared-ux: iOS app install on C08F0148"
xcrun simctl terminate $U app.pantopus.ios 2>/dev/null
xcrun simctl install $U /private/tmp/pantopus-shared-ux-dd/Build/Products/Debug-iphonesimulator/Pantopus.app; RC=$?
/private/tmp/pantopus-tools/heavy-slot.sh release
echo "install rc=$RC at $(date -u +%FT%TZ)"
