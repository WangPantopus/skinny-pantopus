#!/bin/zsh
# iOS simulator build of the native Earn branch against my API (18142 proxy -> 18143), in the heavy slot.
set -u
LOG=/private/tmp/pantopus-stream2-r06-runtime/work/t34-ios-build.log
: > $LOG
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream2: iOS sim build (#325 grouped: 409, replay, vacation) against 18142" >> $LOG 2>&1
echo "slot acquired $(date -u +%FT%TZ) at $(git -C /private/tmp/pantopus-stream2-work-native rev-parse --short HEAD) (+ working tree)" >> $LOG
cd /private/tmp/pantopus-stream2-work-native/frontend/apps/ios || exit 1
xcodegen generate >> $LOG 2>&1
xcodebuild -scheme Pantopus -configuration Debug -destination "platform=iOS Simulator,id=6F914A30-8585-4B05-9E05-94441675F10A" \
  -derivedDataPath /private/tmp/pantopus-stream2-r06-runtime/ios-dd \
  PANTOPUS_API_BASE_URL=http://127.0.0.1:18142 PANTOPUS_SOCKET_URL=http://127.0.0.1:18142 PANTOPUS_PUBLIC_WEB_URL=http://127.0.0.1:18144 \
  build > /private/tmp/pantopus-stream2-r06-runtime/work/t34-ios-xcodebuild.log 2>&1
echo "xcodebuild exit $? $(date -u +%FT%TZ)" >> $LOG
tail -3 /private/tmp/pantopus-stream2-r06-runtime/work/t34-ios-xcodebuild.log >> $LOG
/private/tmp/pantopus-tools/heavy-slot.sh release >> $LOG 2>&1
echo "slot released $(date -u +%FT%TZ)" >> $LOG
