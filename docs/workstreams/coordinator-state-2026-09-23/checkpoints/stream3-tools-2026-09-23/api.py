#!/usr/bin/env python3
"""Owned Stream 3 API helper: log in as a fixture user and run requests; never prints secrets.
usage: api.py <fixture-name> <METHOD path [json]>... ; prints status + sanitized body summary"""
import json, sys, urllib.request, urllib.error
import os as _os
API = _os.environ.get('STREAM3_API', 'http://127.0.0.1:18130')
fx = json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))
def call(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json', 'User-Agent': 'stream3-m1-api-probe'}
    if token: headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=20); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
def login(name):
    u = [x for x in fx if x['name'] == name][0]
    import os
    tf = '/private/tmp/pantopus-stream3-20260923-r1/throwaway-' + u['id'] + '.txt'
    pw = open(tf).read().strip() if os.path.exists(tf) else u['password']
    st, body = call('POST', '/api/users/login', {'email': u['email'], 'password': pw})
    if st != 200: print(json.dumps({'login': name, 'status': st, 'body': body[:200]})); sys.exit(1)
    p = json.loads(body)
    tok = p.get('accessToken') or p.get('access_token') or (p.get('session') or {}).get('access_token')
    return tok
CACHE = '/private/tmp/pantopus-stream3-20260923-r1/.api-token-cache.json'
def cached_token(name):
    import os
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    tok = cache.get(name)
    if tok:
        st, _ = call('GET', '/api/users/profile', None, tok)
        if st == 200: return tok, False
    tok = login(name); cache[name] = tok
    with open(CACHE, 'w') as f: json.dump(cache, f)
    os.chmod(CACHE, 0o600)
    return tok, True
if __name__ == '__main__' and sys.argv[1] == '--logout-all':
    import os
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    for n, t in cache.items(): print(json.dumps({'logout': n, 'status': call('POST', '/api/users/logout', {}, t)[0]}))
    if os.path.exists(CACHE): os.remove(CACHE)
    sys.exit(0)
if __name__ == '__main__':
    name = sys.argv[1]; tok, fresh = cached_token(name)
    print(json.dumps({'login': name, 'status': 200, 'fresh': fresh}))
    args = sys.argv[2:]
    i = 0
    while i < len(args):
        method, path = args[i].split(' ', 1)
        body = None
        if i + 1 < len(args) and args[i+1].startswith('{'):
            body = json.loads(args[i+1]); i += 1
        st, resp = call(method, path, body, tok)
        try: parsed = json.loads(resp)
        except Exception: parsed = resp[:300]
        print(json.dumps({'req': method + ' ' + path, 'status': st, 'body': parsed}))
        i += 1
    # sessions stay cached for reuse; `api.py --logout-all` ends them
