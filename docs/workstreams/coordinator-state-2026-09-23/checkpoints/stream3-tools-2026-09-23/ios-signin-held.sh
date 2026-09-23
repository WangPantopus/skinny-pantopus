#!/bin/zsh
# Stream 3: sign the owned simulator (0AE16FA0 only) into a fixture account without typing or printing
# the credential: install the local harness build, launch it with the credential in the launch
# environment, then reinstall the build under test over it (same data container => same session).
#   ios-signin.sh "<Fixture Name>" <app-dir-under-ios-apps>
set -u
R=/private/tmp/pantopus-stream3-20260923-r1
U=0AE16FA0-E244-414F-86C8-24893BDFD979
NAME=${1:?fixture}; TARGET=${2:?target app dir}
[ -d $R/ios-apps/$TARGET/Pantopus.app ] || { echo "no app $TARGET"; exit 1; }
EMAIL=$(python3 -c "import json,sys;print([x for x in json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json')) if x['name']==sys.argv[1]][0]['email'])" "$NAME")
FID=$(python3 -c "import json,sys;print([x for x in json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json')) if x['name']==sys.argv[1]][0]['id'])" "$NAME")
TF=$R/throwaway-$FID.txt
if [ -f "$TF" ]; then PW=$(tr -d '\n' < "$TF"); else PW=$(python3 -c "import json,sys;print([x for x in json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json')) if x['name']==sys.argv[1]][0]['password'])" "$NAME"); fi
grep -q "stream3: " /private/tmp/pantopus-heavy-slot.lock/owner || { echo "heavy slot not held by stream3"; exit 1; }
xcrun simctl terminate $U app.pantopus.ios 2>/dev/null
xcrun simctl install $U $R/ios-apps/harness/Pantopus.app || {  exit 1; }
BEFORE=$(wc -l < $R/real-auth-http.jsonl)
SIMCTL_CHILD_STREAM3_HARNESS_EMAIL="$EMAIL" SIMCTL_CHILD_STREAM3_HARNESS_PASSWORD="$PW" xcrun simctl launch $U app.pantopus.ios > /dev/null
unset PW
for i in $(seq 1 20); do sleep 2; tail -n +$((BEFORE+1)) $R/real-auth-http.jsonl | grep -q '"/api/users/login"' && break; done
sleep 4
LOGIN=$(tail -n +$((BEFORE+1)) $R/real-auth-http.jsonl | python3 -c "
import json,sys
for l in sys.stdin:
    try: j=json.loads(l)
    except Exception: continue
    if j.get('path','').split('?')[0]=='/api/users/login' or j.get('url','').split('?')[0]=='/api/users/login': print(j.get('status'), j.get('at') or j.get('time'))
" | tail -1)
echo "harness login: ${LOGIN:-none seen}"
xcrun simctl terminate $U app.pantopus.ios 2>/dev/null
xcrun simctl install $U $R/ios-apps/$TARGET/Pantopus.app
: # slot stays with the holder
xcrun simctl launch $U app.pantopus.ios > /dev/null && echo "relaunched $TARGET build as $NAME"
