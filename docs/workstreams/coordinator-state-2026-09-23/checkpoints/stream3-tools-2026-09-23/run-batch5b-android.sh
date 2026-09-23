#!/bin/zsh
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: batch5b Android build (privacy S3-29/S3-09/S3-10, S3-32)" || exit 1
cd $R
./android-build.sh batch5 :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*PrivacyViewModelTest*' --tests '*SettingsViewModelsTest*' > android-build-batch5.driver.log 2>&1; echo "android exit $?" >> android-build-batch5.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
