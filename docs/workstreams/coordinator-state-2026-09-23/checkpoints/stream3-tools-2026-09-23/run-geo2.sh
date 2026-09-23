#!/bin/zsh
R=/private/tmp/pantopus-stream3-20260923-r1
W=/private/tmp/pantopus-stream3-work
[ "$(git -C $W rev-parse HEAD)" = "a9f8be76913e9c993ca4bb0c59d116f80cab92aa" ] || { echo "work tree not at geo2"; exit 1; }
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: geo decode fix Android checks + APK, rerun (BLOCKING business profile)" || exit 1
cd $R
./android-build.sh geo2 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*BusinessServiceArea*' --tests '*BusinessOwner*' --tests '*MyBusinesses*' --tests '*PulsePostTarget*' --tests '*PulseCompose*' > android-build-geo2.driver.log 2>&1; echo "android exit $?" >> android-build-geo2.driver.log
( cd $W/frontend/apps/android && JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ./gradlew --stop ) >> android-build-geo2.driver.log 2>&1
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
