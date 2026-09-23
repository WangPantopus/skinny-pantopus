#!/bin/zsh
# #371 merge (4a7b03672) Android checks + APK, as its own heavy-slot hold (coordinator 18:39Z: split builds; stop Gradle after).
R=/private/tmp/pantopus-stream3-20260923-r1
W=/private/tmp/pantopus-stream3-work
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: #371 master-merge Android checks + APK" || exit 1
rm -f $R/HOLD-ANDROID
[ "$(git -C $W rev-parse HEAD)" = "4a7b0367221c20986e605ed5f6f7e96a3af92832" ] || { echo "work tree not at biz371"; /private/tmp/pantopus-tools/heavy-slot.sh release; exit 1; }
cd $R
./android-build.sh biz371 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*BusinessOwner*' --tests '*MyBusinesses*' --tests '*BizBanner*' > android-build-biz371.driver.log 2>&1; echo "android exit $?" >> android-build-biz371.driver.log
( cd $W/frontend/apps/android && JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ./gradlew --stop ) >> android-build-biz371.driver.log 2>&1
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
