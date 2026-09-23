#!/bin/zsh
# combo6 Android (master f02dd4bd1 + scheduling 11eca4045 + policy b33c3294f), then #371 merged head 4a7b03672 (iOS + Android).
R=/private/tmp/pantopus-stream3-20260923-r1
W=/private/tmp/pantopus-stream3-work
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: combo6 Android (scheduling + policy) and #371 master-merge iOS + Android builds" || exit 1
cd $R
./android-build.sh combo6 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*Onboarding*' --tests '*PublicProfile*' --tests '*Discovery*' --tests '*Setup*' --tests '*CreatorInbox*' --tests '*HelpCenter*' --tests '*SchedulingHub*' --tests '*HubSnapshot*' > android-build-combo6.driver.log 2>&1; echo "android exit $?" >> android-build-combo6.driver.log
# switch the verification tree to the #371 merge
cd $W && git reset -q --mixed 4a7b0367221c20986e605ed5f6f7e96a3af92832 && git checkout -- frontend/apps/ios frontend/apps/android && git status --short | head -3 > $R/biz371-tree-status.txt; git rev-parse HEAD >> $R/biz371-tree-status.txt
cd $R
./ios-build-master-and-harness.sh biz371 > ios-build-biz371.driver.log 2>&1; echo "ios exit $?" >> ios-build-biz371.driver.log
./android-build.sh biz371 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*BusinessProfile*' --tests '*BusinessOwner*' --tests '*MyBusinesses*' --tests '*BizBanner*' > android-build-biz371.driver.log 2>&1; echo "android exit $?" >> android-build-biz371.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
