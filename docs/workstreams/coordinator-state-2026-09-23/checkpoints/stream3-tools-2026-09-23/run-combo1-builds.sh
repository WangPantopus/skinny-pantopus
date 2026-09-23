#!/bin/zsh
# combo1: master + chat 2b076dc5f + business c4e124d81. iOS app + Android checks (Connections, owner, my businesses) and APK.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: combo1 iOS + Android builds (chat + business verification claims)" || exit 1
cd $R
./ios-build-master-and-harness.sh combo1 > ios-build-combo1.driver.log 2>&1; echo "ios exit $?" >> ios-build-combo1.driver.log
./android-build.sh combo1 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*Connections*' --tests '*BusinessOwner*' --tests '*MyBusinesses*' --tests '*BusinessProfile*' --tests '*NewMessage*' --tests '*ChatList*' > android-build-combo1.driver.log 2>&1; echo "android exit $?" >> android-build-combo1.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
