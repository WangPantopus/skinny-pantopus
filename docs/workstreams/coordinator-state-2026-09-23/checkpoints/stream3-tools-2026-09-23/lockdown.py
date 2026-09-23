#!/usr/bin/env python3
"""Real 'Sign out everywhere' (lockdown) for an owned fixture: login -> reauthenticate (password
step-up) -> POST /api/auth/sessions/revoke-all with X-Step-Up. Never prints secrets."""
import json, sys, os, urllib.request, urllib.error, datetime
API = 'http://127.0.0.1:18130'
fx = json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))
u = [x for x in fx if x['name'] == sys.argv[1]][0]
tf = '/private/tmp/pantopus-stream3-20260923-r1/throwaway-' + u['id'] + '.txt'
pw = open(tf).read().strip() if os.path.exists(tf) else u['password']
def call(method, path, body=None, token=None, extra=None):
    h = {'Content-Type': 'application/json', 'User-Agent': 'stream3-lockdown'}
    if token: h['Authorization'] = 'Bearer ' + token
    if extra: h.update(extra)
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=20); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
st, body = call('POST', '/api/users/login', {'email': u['email'], 'password': pw}); print('login', st)
if st != 200: sys.exit(1)
tok = json.loads(body).get('accessToken')
st, body = call('POST', '/api/users/reauthenticate', {'password': pw}, tok); print('reauthenticate', st)
step = json.loads(body).get('stepUpToken') if st == 200 else None
st, body = call('POST', '/api/auth/sessions/revoke-all', {}, tok, {'X-Step-Up': step or ''}); print('revoke-all', st)
print(json.dumps({'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'fixture': sys.argv[1], 'revokeAll': st}))
