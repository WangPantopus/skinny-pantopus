#!/usr/bin/env python3
"""Real forgot/reset password flow for an owned local fixture (API 18130 + Mailpit 64536).
usage: password-flow.py "<Fixture Name>" throwaway   -> sets the private throwaway (stored 0600 in the run dir)
       password-flow.py "<Fixture Name>" restore     -> restores the fixture value from the private fixture file
Never prints password values."""
import json, re, sys, time, urllib.request, urllib.error, datetime, os, secrets
API = 'http://127.0.0.1:18130'; MP = 'http://127.0.0.1:64536'
RUN = '/private/tmp/pantopus-stream3-20260923-r1'
fx = json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))
name, mode = sys.argv[1], sys.argv[2]
u = [x for x in fx if x['name'] == name][0]
def post(path, body, token=None):
    h = {'Content-Type': 'application/json', 'User-Agent': 'stream3-password-flow'}
    if token: h['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), headers=h, method='POST')
    try:
        r = urllib.request.urlopen(req, timeout=20); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
tfile = os.path.join(RUN, 'throwaway-' + u['id'] + '.txt')
if mode == 'throwaway':
    new = 'S3tmp-' + secrets.token_hex(4) + '-Aa9'
else:
    new = u['password']
before = time.time()
st, _ = post('/api/users/forgot-password', {'email': u['email']}); print('forgot', st)
tok = None
for _ in range(20):
    time.sleep(1)
    msgs = json.load(urllib.request.urlopen(MP + '/api/v1/messages?limit=10'))['messages']
    cand = [m for m in msgs if u['email'] in json.dumps(m['To']).lower() and 'reset' in m['Subject'].lower()]
    if cand:
        m = cand[0]
        created = datetime.datetime.fromisoformat(m['Created'].replace('Z', '+00:00')).timestamp()
        if created >= before - 2:
            body = urllib.request.urlopen(MP + '/api/v1/message/' + m['ID']).read().decode()
            mt = re.search(r'token(?:_hash)?=([A-Za-z0-9_\-]+)', body)
            if mt: tok = mt.group(1); break
print('reset-mail', 'found' if tok else 'missing')
if not tok: sys.exit(1)
st, resp = post('/api/users/reset-password', {'token': tok, 'newPassword': new}); print('reset', st)
if mode == 'throwaway' and st == 200:
    # Record the throwaway only once the reset actually succeeded.
    open(tfile, 'w').write(new); os.chmod(tfile, 0o600)
st2, resp2 = post('/api/users/login', {'email': u['email'], 'password': new}); print('login-check', st2)
if st2 == 200:
    p = json.loads(resp2); acc = p.get('accessToken') or p.get('access_token')
    if acc: print('logout', post('/api/users/logout', {}, acc)[0])
if mode == 'restore' and st == 200 and os.path.exists(tfile): os.remove(tfile); print('throwaway file removed')
print(json.dumps({'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'fixture': name, 'mode': mode, 'forgot': 'ok', 'reset': st, 'loginCheck': st2}))
