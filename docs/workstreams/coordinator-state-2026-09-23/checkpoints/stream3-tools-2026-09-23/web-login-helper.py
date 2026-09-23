#!/usr/bin/env python3
"""Loopback-only helper on stream3-auth.localhost:18134. GET /login-as?who=<Fixture Name>&next=/path
performs the real POST /api/users/login (x-token-transport: cookie) server-side and relays the
server-issued Set-Cookie headers (host-only; cookies ignore ports) with a 302 to the owned Next
origin. Credentials are read from the private fixture file and never printed or logged."""
import http.server, json, urllib.request, urllib.error, urllib.parse, sys, datetime
FX = json.load(open('/private/tmp/pantopus-stream3-20260920-r1/auth-fixtures.json'))
API = 'http://127.0.0.1:18130'; NEXT = 'http://stream3-auth.localhost:18131'
LOG = '/private/tmp/pantopus-stream3-20260923-r1/web-login-helper.jsonl'
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path != '/login-as': self.send_response(404); self.end_headers(); return
        who = q.get('who', [''])[0]; nxt = q.get('next', ['/'])[0]
        if not nxt.startswith('/'): nxt = '/'
        users = [x for x in FX if x['name'] == who]
        if not users: self.send_response(400); self.end_headers(); return
        import os
        tf = '/private/tmp/pantopus-stream3-20260923-r1/throwaway-' + users[0]['id'] + '.txt'
        pw = open(tf).read().strip() if os.path.exists(tf) else users[0]['password']
        body = json.dumps({'email': users[0]['email'], 'password': pw}).encode()
        req = urllib.request.Request(API + '/api/users/login', data=body, method='POST', headers={
            'Content-Type': 'application/json', 'x-token-transport': 'cookie',
            'User-Agent': self.headers.get('User-Agent', 'stream3-web-login-helper')})
        try:
            r = urllib.request.urlopen(req, timeout=20); status = r.status; cookies = r.headers.get_all('Set-Cookie') or []
        except urllib.error.HTTPError as e:
            status = e.code; cookies = []
        with open(LOG, 'a') as f:
            f.write(json.dumps({'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'who': who, 'loginStatus': status,
                                'cookieNames': [c.split('=')[0] for c in cookies], 'next': nxt}) + '\n')
        if status != 200:
            self.send_response(502); self.end_headers(); self.wfile.write(b'login failed'); return
        self.send_response(302)
        for c in cookies:
            self.send_header('Set-Cookie', c)
        self.send_header('Location', NEXT + nxt); self.end_headers()
http.server.HTTPServer(('127.0.0.1', 18134), H).serve_forever()
