#!/usr/bin/env python3
"""rel-conceal-check.py <api-base> <label>: legacy Relationship block concealment journey (blocker Auth Dana blocks Auth Bob; Auth Evan is a stranger; roles keep the Alice/Charlie/Bob keys).
Prints statuses and the fields that matter; never prints tokens. Cleans up by the real unblock routes."""
import json, sys, os
os.environ['STREAM3_API'] = sys.argv[1]
import importlib.util
spec = importlib.util.spec_from_file_location('api', '/private/tmp/pantopus-stream3-20260923-r1/api.py'); api = importlib.util.module_from_spec(spec); spec.loader.exec_module(api)
label = sys.argv[2]
fx = {x['name']: x['id'] for x in json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))}
A, C, B = fx['Auth Dana'], fx['Auth Bob'], fx['Auth Evan']
tok = {n: api.cached_token(n)[0] for n in ['Auth Dana', 'Auth Bob', 'Auth Evan']}
R = {'Auth Alice': 'Auth Dana', 'Auth Charlie': 'Auth Bob', 'Auth Bob': 'Auth Evan'}
out = []
def step(role, method, path, body=None, keep=None):
    who = R[role]
    st, raw = api.call(method, path, body, tok[who])
    try: j = json.loads(raw)
    except Exception: j = raw[:200]
    rec = {'who': {'Auth Alice': 'blocker', 'Auth Charlie': 'blocked', 'Auth Bob': 'stranger'}[role], 'req': f'{method} {path.replace(A,"<blocker>").replace(C,"<blocked>").replace(B,"<stranger>")}', 'status': st}
    if keep: rec.update(keep(j))
    else: rec['body'] = j
    out.append(rec); return st, j
st, j = step('Auth Alice', 'POST', '/api/relationships/block-user', {'user_id': C}, lambda j: {'message': j.get('message'), 'blocked_by_is_alice': (j.get('relationship') or {}).get('blocked_by') == A})
rid = (j.get('relationship') or {}).get('id')
def rows_with_pair(j):
    rels = j.get('relationships', [])
    hit = [r for r in rels if {r.get('requester', {}).get('id') if isinstance(r.get('requester'), dict) else None, r.get('other_user', {}).get('id') if isinstance(r.get('other_user'), dict) else None} & {A, C}]
    return {'pair_rows': [{'status': r.get('status'), 'blocked_by_present': r.get('blocked_by') is not None} for r in rels if r.get('id') == rid]}
step('Auth Alice', 'GET', '/api/relationships', keep=rows_with_pair)
step('Auth Charlie', 'GET', '/api/relationships', keep=rows_with_pair)
step('Auth Alice', 'GET', f'/api/users/{C}/relationship', keep=lambda j: {'relationship': j.get('relationship')})
step('Auth Charlie', 'GET', f'/api/users/{A}/relationship', keep=lambda j: {'relationship': j.get('relationship')})
for who in ['Auth Charlie', 'Auth Bob']:
    step(who, 'POST', f'/api/relationships/{rid}/unblock')
step('Auth Charlie', 'POST', f'/api/relationships/{rid}/accept')
step('Auth Charlie', 'POST', f'/api/relationships/{rid}/reject')
step('Auth Charlie', 'POST', f'/api/relationships/{rid}/block', {})
step('Auth Charlie', 'DELETE', f'/api/relationships/{rid}')
step('Auth Bob', 'DELETE', f'/api/relationships/{rid}')
step('Auth Charlie', 'POST', '/api/relationships/block-user', {'user_id': A})
step('Auth Alice', 'POST', f'/api/relationships/{rid}/unblock')
step('Auth Alice', 'GET', '/api/relationships/blocked', keep=lambda j: {'blocked_count_with_charlie': sum(1 for r in j.get('blocked', []) if (r.get('blocked_user') or {}).get('id') == C)})
# cleanup of any personal block Charlie recorded (real route), so the fixture pair ends clean
step('Auth Charlie', 'DELETE', f'/api/users/{A}/block', keep=lambda j: {'ok': j.get('success', j)})
print(json.dumps({'label': label, 'relationship_id_prefix': (rid or '')[:8], 'steps': out}, indent=1))
