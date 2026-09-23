#!/bin/zsh
# android-harness-signin.sh "<Fixture Name>": push the fixture credential into the harness app's private files
# (run-as; never printed, never on a command line), then launch the harness app so it signs in once.
# The harness APK must already be installed. The temp file is removed immediately.
set -u
R=/private/tmp/pantopus-stream3-20260923-r1
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
NAME=${1:?fixture}
TMP=$(mktemp $R/.harness-cred.XXXXXX); chmod 600 $TMP
python3 - "$NAME" "$TMP" <<'PY'
import json, os, sys
name, out = sys.argv[1], sys.argv[2]
pool = json.load(open('/private/tmp/pantopus-stream3-20260923-r1/disposable-fixtures.json')) + json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))
u = [x for x in pool if x['name'] == name][0]
tf = '/private/tmp/pantopus-stream3-20260923-r1/throwaway-' + u['id'] + '.txt'
pw = open(tf).read().strip() if os.path.exists(tf) else u['password']
json.dump({'email': u['email'], 'password': pw}, open(out, 'w'))
PY
eval "$ADB shell am force-stop app.pantopus.android.debug"
eval "$ADB shell \"run-as app.pantopus.android.debug sh -c 'mkdir -p files && cat > files/stream3-harness.json'\"" < $TMP
rm -f $TMP
eval "$ADB shell am start -n app.pantopus.android.debug/app.pantopus.android.MainActivity" > /dev/null
echo "harness credential pushed for $NAME and app launched"
