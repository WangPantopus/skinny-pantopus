#!/usr/bin/env python3
"""delete-disposable.py "<Fixture Name>": remove a #271 disposable account through the real app path
(login -> password step-up -> DELETE /api/users/account). Never prints the credential or tokens."""
import json, sys, urllib.request, urllib.error
API = 'http://127.0.0.1:18130'
name = sys.argv[1]
u = [x for x in json.load(open('/private/tmp/pantopus-stream3-20260923-r1/disposable-fixtures.json')) if x['name'] == name][0]
def call(method, path, body=None, headers=None):
    h = {'Content-Type': 'application/json', 'User-Agent': 'stream3-271-cleanup'}
    h.update(headers or {})
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
st, body = call('POST', '/api/users/login', {'email': u['email'], 'password': u['password']})
print(json.dumps({'login': name, 'status': st}))
if st != 200: sys.exit(1)
p = json.loads(body); tok = p.get('accessToken') or p.get('access_token') or (p.get('session') or {}).get('access_token')
auth = {'Authorization': 'Bearer ' + tok}
st, body = call('POST', '/api/auth/step-up', {'purpose': 'delete_account', 'method': 'password', 'password': u['password']}, auth)
print(json.dumps({'step-up': st}))
if st != 200: sys.exit(1)
su = json.loads(body)['stepUpToken']
st, body = call('DELETE', '/api/users/account', None, {**auth, 'X-Step-Up': su})
try: b = json.loads(body)
except Exception: b = body[:200]
print(json.dumps({'DELETE /api/users/account': st, 'body': b if isinstance(b, dict) and 'token' not in json.dumps(b).lower() else '(omitted)'}))
