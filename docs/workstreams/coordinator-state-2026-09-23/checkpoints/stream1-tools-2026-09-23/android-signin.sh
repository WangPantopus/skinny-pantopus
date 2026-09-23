#!/bin/zsh
# Fixture OAuth sign-in on emulator-5558: android-signin.sh <actorIndex>. Never accepts Chrome's first-run terms.
export ANDROID_SERIAL=emulator-5558; A=/Users/yingpengwang/Library/Android/sdk/platform-tools/adb
curl -s -m 5 -X POST http://127.0.0.1:18132/api/__fixture/oauth-actor -H 'content-type: application/json' -d "{\"index\":$1}"; echo
python3 /private/tmp/pantopus-tools/aui.py tap "Continue with Google" 0; sleep 3
N=$(curl -s -m 5 http://127.0.0.1:18132/api/__fixture/state | python3 -c "import json,sys,re; d=json.load(sys.stdin); r=[x for x in d['requests'] if 'oauth/google' in x['path']]; print(re.search(r'app_nonce%3D([0-9a-f]+)', r[-1]['path']).group(1))")
$A shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "pantopus://auth/callback?app_nonce=$N\&code=fixture-oauth-$1" 2>&1 | tail -1
sleep 5
curl -s -m 5 http://127.0.0.1:18132/api/__fixture/state | python3 -c "import json,sys; d=json.load(sys.stdin); r=[x for x in d['requests'] if 'oauth/callback' in x['path']]; print(r[-1] if r else 'no callback')"
