#!/bin/zsh
# geo: master 9779bf9d3 + business geo decode fix e14772edc. iOS then Android, slot released between.
R=/private/tmp/pantopus-stream3-20260923-r1
W=/private/tmp/pantopus-stream3-work
[ "$(git -C $W rev-parse HEAD)" = "e14772edc754cd42ce8abad8d060d262cf3b0108" ] || { echo "work tree not at geo"; exit 1; }
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: geo decode fix iOS build (BLOCKING business profile)" || exit 1
cd $R
./ios-build-master-and-harness.sh geo > ios-build-geo.driver.log 2>&1; echo "ios exit $?" >> ios-build-geo.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: geo decode fix Android checks + APK (BLOCKING business profile)" || exit 1
./android-build.sh geo --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*BusinessServiceArea*' --tests '*BusinessOwner*' --tests '*MyBusinesses*' > android-build-geo.driver.log 2>&1; echo "android exit $?" >> android-build-geo.driver.log
( cd $W/frontend/apps/android && JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ./gradlew --stop ) >> android-build-geo.driver.log 2>&1
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
