#!/usr/bin/env python3
"""neighbor-reply-check.py <api-base> <label>: reply copy when either side blocks (sender Auth Evan, recipient Auth Bob) on one seeded NeighborMessage.
Blocks are made and lifted through the real /api/users/:id/block routes; prints statuses and bodies only."""
import json, sys, os
os.environ['STREAM3_API'] = sys.argv[1]
import importlib.util
spec = importlib.util.spec_from_file_location('api', '/private/tmp/pantopus-stream3-20260923-r1/api.py'); api = importlib.util.module_from_spec(spec); spec.loader.exec_module(api)
fx = {x['name']: x['id'] for x in json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))}
EVAN, BOB = fx['Auth Evan'], fx['Auth Bob']
tok = {n: api.cached_token(n)[0] for n in ['Auth Evan', 'Auth Bob']}
MID = 'a5303000-0000-4000-8000-000000000001'
out = []
def step(case, who, method, path, body=None):
    st, raw = api.call(method, path, body, tok[who])
    try: j = json.loads(raw)
    except Exception: j = raw[:200]
    if isinstance(j, dict) and 'can_reply' in j: j = {'can_reply': j.get('can_reply')}
    out.append({'case': case, 'who': 'sender' if who == 'Auth Evan' else 'recipient', 'req': f"{method} {path.replace(EVAN,'<sender>').replace(BOB,'<recipient>')}", 'status': st, 'body': j})
step('sender blocked recipient', 'Auth Evan', 'POST', f'/api/users/{BOB}/block', {})
step('sender blocked recipient', 'Auth Bob', 'GET', f'/api/neighbor-messages/{MID}')
step('sender blocked recipient', 'Auth Bob', 'POST', f'/api/neighbor-messages/{MID}/reply', {'reply_template_id': 'thanks'})
step('sender blocked recipient', 'Auth Evan', 'DELETE', f'/api/users/{BOB}/block')
step('recipient blocked sender', 'Auth Bob', 'POST', f'/api/users/{EVAN}/block', {})
step('recipient blocked sender', 'Auth Bob', 'GET', f'/api/neighbor-messages/{MID}')
step('recipient blocked sender', 'Auth Bob', 'POST', f'/api/neighbor-messages/{MID}/reply', {'reply_template_id': 'thanks'})
step('recipient blocked sender', 'Auth Bob', 'DELETE', f'/api/users/{EVAN}/block')
print(json.dumps({'label': sys.argv[2], 'message_id': MID, 'steps': out}, indent=1))
