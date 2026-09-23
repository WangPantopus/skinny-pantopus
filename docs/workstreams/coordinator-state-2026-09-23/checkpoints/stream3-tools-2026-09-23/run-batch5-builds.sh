#!/bin/zsh
# batch5: iOS (+harness) and Android builds of stream3-batch5-verify under the heavy slot.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: batch5 iOS (+harness) and Android builds (privacy S3-29/S3-09/S3-10, S3-32)" || exit 1
cd $R
./ios-build-master-and-harness.sh batch5 harness > ios-build-batch5.driver.log 2>&1; echo "ios exit $?" >> ios-build-batch5.driver.log
./android-build.sh batch5 :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*PrivacyViewModelTest*' --tests '*SettingsViewModelsTest*' > android-build-batch5.driver.log 2>&1; echo "android exit $?" >> android-build-batch5.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
