#!/bin/zsh
# batch6c: Android checks + APK for b78b30619 (business profile claims + S3-07, import order fixed)
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: batch6c Android ktlint/detekt/tests + APK (business profile claims + S3-07)" || exit 1
cd $R
./android-build.sh batch6c --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*MyBusinesses*' --tests '*BusinessEarnPrimitives*' > android-build-batch6c.driver.log 2>&1; echo "android exit $?" >> android-build-batch6c.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
