#!/bin/zsh
# Build the iOS Debug app from a worktree against the Stream 1 harness port (never :8000).
# usage: build-ios.sh <worktree> <port> <derived-data> <logfile>
set -u
W=$1; PORT=$2; DD=$3; LOG=$4
cd $W/frontend/apps/ios || exit 2
grep -q "127.0.0.1:$PORT" Config/Secrets.xcconfig || { echo "Secrets.xcconfig lacks the port"; exit 3; }
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream1: xcodebuild iOS Debug $(git -C $W rev-parse --short HEAD)"
trap '/private/tmp/pantopus-tools/heavy-slot.sh release' EXIT
start=$(date -u +%FT%TZ)
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus -configuration Debug \
  -destination "platform=iOS Simulator,id=F4DBD47E-ED21-4B85-941B-6B0C61DD5A31" -derivedDataPath $DD \
  PANTOPUS_API_BASE_URL="http://127.0.0.1:$PORT" PANTOPUS_SOCKET_URL="http://127.0.0.1:$PORT" build > $LOG 2>&1
rc=$?
echo "build rc=$rc start=$start end=$(date -u +%FT%TZ)" | tee -a $LOG
APP=$(find $DD/Build/Products/Debug-iphonesimulator -maxdepth 1 -name "*.app" | head -1)
echo "app: $APP" | tee -a $LOG
/usr/libexec/PlistBuddy -c "Print :PantopusAPIBaseURL" "$APP/Info.plist" | tee -a $LOG
/usr/libexec/PlistBuddy -c "Print :PantopusSocketURL" "$APP/Info.plist" 2>/dev/null | tee -a $LOG
if grep -a -q "localhost:8000\|127.0.0.1:8000" "$APP/Info.plist"; then echo "FAIL: Info.plist has :8000" | tee -a $LOG; exit 5; fi
for f in "$APP/Pantopus.debug.dylib" "$APP/Pantopus"; do [ -f "$f" ] && { echo "$(basename $f): 8000-refs=$(grep -a -c 'localhost:8000\|127.0.0.1:8000\|10.0.2.2:8000' "$f") port-refs=$(grep -a -c "127.0.0.1:$PORT" "$f")" | tee -a $LOG; }; done
shasum -a 256 "$APP/Pantopus.debug.dylib" 2>/dev/null | tee -a $LOG
exit $rc
