#!/bin/zsh
# Stream 3 #271: launch the LOCAL-ONLY harness build (sign-in + step-up hooks, never committed) on the
# owned simulator (0AE16FA0 only) with a fixture credential in the launch environment and KEEP it running,
# so the delete-account step-up reads the password from the environment. Nothing is typed or printed.
#   ios-harness-run.sh "<Fixture Name>"   (looks in disposable-fixtures.json, then auth-fixtures.json)
set -u
R=/private/tmp/pantopus-stream3-20260923-r1
U=0AE16FA0-E244-414F-86C8-24893BDFD979
NAME=${1:?fixture}
read EMAIL FID <<< "$(python3 - "$NAME" <<'PY'
import json, sys
name = sys.argv[1]
for f in ['/private/tmp/pantopus-stream3-20260923-r1/disposable-fixtures.json', '/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json']:
    for x in json.load(open(f)):
        if x['name'] == name:
            print(x['email'], x['id']); sys.exit(0)
sys.exit(1)
PY
)" || { echo "no fixture $NAME"; exit 1; }
PW=$(python3 - "$NAME" <<'PY'
import json, os, sys
name = sys.argv[1]
for f in ['/private/tmp/pantopus-stream3-20260923-r1/disposable-fixtures.json', '/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json']:
    for x in json.load(open(f)):
        if x['name'] == name:
            tf = '/private/tmp/pantopus-stream3-20260923-r1/throwaway-' + x['id'] + '.txt'
            print(open(tf).read().strip() if os.path.exists(tf) else x['password']); sys.exit(0)
PY
)
xcrun simctl terminate $U app.pantopus.ios 2>/dev/null
if [ "${2:-}" = "--install" ]; then xcrun simctl install $U $R/ios-apps/harness/Pantopus.app || exit 1; echo "installed harness"; fi
BEFORE=$(wc -l < $R/real-auth-http.jsonl)
SIMCTL_CHILD_STREAM3_HARNESS_EMAIL="$EMAIL" SIMCTL_CHILD_STREAM3_HARNESS_PASSWORD="$PW" xcrun simctl launch $U app.pantopus.ios > /dev/null
unset PW
for i in $(seq 1 15); do sleep 2; tail -n +$((BEFORE+1)) $R/real-auth-http.jsonl | grep -q '"/api/users/login"' && break; done
LOGIN=$(tail -n +$((BEFORE+1)) $R/real-auth-http.jsonl | python3 -c "
import json,sys
for l in sys.stdin:
    try: j=json.loads(l)
    except Exception: continue
    p=(j.get('path') or j.get('url') or '').split('?')[0]
    if p=='/api/users/login': print(j.get('status'), j.get('at') or j.get('time'))
" | tail -1)
echo "harness launched as $NAME (${FID:0:8}); login: ${LOGIN:-none seen (already signed in?)}"
