#!/usr/bin/env bash
# Compile gate for the RN→native parity waves.
#   ./gate.sh ios      → xcodegen + xcodebuild (simulator, Debug) + test-target compile
#   ./gate.sh android  → :app:compileDebugKotlin + both test source sets
#   ./gate.sh both     → ios then android
#
# The gate compiles the app AND every test source set on each platform. It did
# not always: for three medium/low waves it built only the app targets, and the
# Android unit-test target silently stopped compiling at Wave B (28cf1ca9)
# without anything going red. The instrumented source set hid a second failure
# the same way. A green gate must mean the tests still build.
#
# Writes full logs to $GATE_LOGDIR (default: a tmp dir) and prints only errors.
set -uo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
LOGDIR="${GATE_LOGDIR:-${TMPDIR:-/tmp}/pantopus-parity-gate}"
mkdir -p "$LOGDIR"

# Android needs a JDK 17 and an SDK location. local.properties is gitignored, so
# ANDROID_HOME is the portable route. Take whichever JDK 17 this machine has.
if [ -z "${JAVA_HOME:-}" ]; then
  for jdk in /Library/Java/JavaVirtualMachines/*-17*/Contents/Home; do
    [ -x "$jdk/bin/javac" ] && export JAVA_HOME="$jdk" && break
  done
fi
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

gate_ios() {
  echo "=== iOS gate (app + test target) ==="
  if [ ! -d "$ROOT/frontend/apps/ios" ]; then echo "iOS: MISSING $ROOT/frontend/apps/ios"; return 2; fi
  # `build-for-testing` compiles the app AND PantopusTests; plain `build` does not.
  ( cd "$ROOT/frontend/apps/ios" && make bootstrap && xcodebuild \
      -project Pantopus.xcodeproj -scheme Pantopus \
      -destination "$(xcrun simctl list devices available \
        | awk -F '[()]' '/iPhone/ { print "platform=iOS Simulator,id="$2; exit }')" \
      -configuration Debug build-for-testing ) >"$LOGDIR/gate-ios.log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ] && grep -q "BUILD SUCCEEDED" "$LOGDIR/gate-ios.log"; then
    echo "iOS: BUILD SUCCEEDED (app + tests)"
  else
    echo "iOS: FAILED (rc=$rc) — log $LOGDIR/gate-ios.log"
    grep -E "error:|error :|Undefined symbol|fatal error" "$LOGDIR/gate-ios.log" \
      | sed "s|$ROOT/frontend/apps/ios/||" | sort -u | head -80
  fi
  return $rc
}

gate_android() {
  echo "=== Android gate (app + unit-test source set) ==="
  if [ ! -d "$ROOT/frontend/apps/android" ]; then echo "Android: MISSING $ROOT/frontend/apps/android"; return 2; fi
  if [ ! -d "$ANDROID_HOME" ]; then
    echo "Android: FAILED — no SDK at ANDROID_HOME=$ANDROID_HOME."
    echo "  Set ANDROID_HOME, or write sdk.dir to frontend/apps/android/local.properties."
    return 2
  fi
  ( cd "$ROOT/frontend/apps/android" \
    && ./gradlew :app:compileDebugKotlin :app:compileDebugUnitTestKotlin \
         :app:compileDebugAndroidTestKotlin --console=plain \
  ) >"$LOGDIR/gate-android.log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo "Android: BUILD SUCCESSFUL (app + tests)"
  else
    echo "Android: FAILED (rc=$rc) — log $LOGDIR/gate-android.log"
    grep -E "^e: |error: |Caused by|Unresolved reference|SDK location not found" "$LOGDIR/gate-android.log" \
      | sed "s|file://$ROOT/frontend/apps/android/||" | sort -u | head -80
  fi
  return $rc
}

case "${1:-both}" in
  ios) gate_ios ;;
  android) gate_android ;;
  both) gate_ios; i=$?; gate_android; a=$?; exit $(( i || a )) ;;
  *) echo "usage: gate.sh [ios|android|both]"; exit 2 ;;
esac
