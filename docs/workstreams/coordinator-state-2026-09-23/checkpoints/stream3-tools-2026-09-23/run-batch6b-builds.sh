#!/bin/zsh
# batch6b: business profile verified claims + S3-07 (report sheet, dock). iOS pure + Android checks and APK.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: batch6b iOS + Android builds (business profile: verified claims + S3-07)" || exit 1
cd $R
./ios-build-master-and-harness.sh batch6b > ios-build-batch6b.driver.log 2>&1; echo "ios exit $?" >> ios-build-batch6b.driver.log
./android-build.sh batch6b :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*MyBusinesses*' --tests '*BusinessEarnPrimitives*' > android-build-batch6b.driver.log 2>&1; echo "android exit $?" >> android-build-batch6b.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
