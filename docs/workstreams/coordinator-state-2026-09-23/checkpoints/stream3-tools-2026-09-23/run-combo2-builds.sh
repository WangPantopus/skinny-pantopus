#!/bin/zsh
# combo2: master + chat 2b076dc5f + business c4e124d81 + profile f5a38aab4. iOS app + Android checks (Connections, owner, my businesses) and APK.
R=/private/tmp/pantopus-stream3-20260923-r1
/private/tmp/pantopus-tools/heavy-slot.sh acquire "stream3: combo2 iOS + Android builds (chat + business verification claims)" || exit 1
cd $R
./ios-build-master-and-harness.sh combo2 > ios-build-combo2.driver.log 2>&1; echo "ios exit $?" >> ios-build-combo2.driver.log
./android-build.sh combo2 --continue --no-build-cache :app:ktlintCheck :app:detekt :app:testDebugUnitTest --tests '*Connections*' --tests '*PublicProfile*' --tests '*ViewAs*' --tests '*BusinessOwner*' --tests '*MyBusinesses*' --tests '*BusinessProfile*' --tests '*NewMessage*' --tests '*ChatList*' > android-build-combo2.driver.log 2>&1; echo "android exit $?" >> android-build-combo2.driver.log
/private/tmp/pantopus-tools/heavy-slot.sh release | tail -1
