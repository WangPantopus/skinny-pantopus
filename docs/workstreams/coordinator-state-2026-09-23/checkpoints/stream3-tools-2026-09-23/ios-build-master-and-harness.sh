#!/bin/zsh
# Stream 3: build the pure-master iOS app and the local sign-in harness variant (harness never committed).
set -u
R=/private/tmp/pantopus-stream3-20260923-r1
W=/private/tmp/pantopus-stream3-work
U=0AE16FA0-E244-414F-86C8-24893BDFD979
TAG=${1:?tag}
cd $W/frontend/apps/ios || exit 1
SHA=$(git rev-parse HEAD)
echo "head $SHA" > $R/ios-build-$TAG.head
xcodegen generate --quiet > $R/ios-build-$TAG.xcodegen.log 2>&1 || { echo "xcodegen failed"; exit 1; }
build() {
  xcodebuild -project Pantopus.xcodeproj -scheme Pantopus -configuration Debug \
    -destination "platform=iOS Simulator,id=$U" -derivedDataPath $R/ios-dd \
    -clonedSourcePackagesDirPath /private/tmp/pantopus-stream3-20260920-r1/ios-dd/SourcePackages \
    PANTOPUS_API_BASE_URL='http://127.0.0.1:18130' PANTOPUS_SOCKET_URL='http://127.0.0.1:18130' \
    PANTOPUS_PUBLIC_WEB_URL='http://127.0.0.1:18131' build
}
APP=$R/ios-dd/Build/Products/Debug-iphonesimulator/Pantopus.app
( time build ) > $R/ios-build-$TAG.log 2>&1; rc=$?
echo "master build exit $rc" >> $R/ios-build-$TAG.log
[ $rc -eq 0 ] || exit $rc
rm -rf $R/ios-apps/master-$TAG; mkdir -p $R/ios-apps/master-$TAG; cp -Rc $APP $R/ios-apps/master-$TAG/
shasum -a 256 $APP/Pantopus.debug.dylib | cut -d' ' -f1 > $R/ios-apps/master-$TAG/dylib.sha256
if [ "${2:-}" = "harness" ]; then
  git apply $R/ios-signin-harness.patch || exit 1
  git -C $W apply $R/ios-stepup-harness.patch || { git checkout -- Pantopus/App/PantopusApp.swift; exit 1; }
  ( time build ) > $R/ios-build-$TAG-harness.log 2>&1; rc=$?
  git checkout -- Pantopus/App/PantopusApp.swift Pantopus/Core/Auth/AuthManager+Devices.swift
  echo "harness build exit $rc" >> $R/ios-build-$TAG-harness.log
  [ $rc -eq 0 ] || exit $rc
  rm -rf $R/ios-apps/harness; mkdir -p $R/ios-apps/harness; cp -Rc $APP $R/ios-apps/harness/
  shasum -a 256 $APP/Pantopus.debug.dylib | cut -d' ' -f1 > $R/ios-apps/harness/dylib.sha256
  echo "harness source $SHA + ios-signin-harness.patch + ios-stepup-harness.patch" > $R/ios-apps/harness/SOURCE.txt
fi
git status --short | head -5
echo done
