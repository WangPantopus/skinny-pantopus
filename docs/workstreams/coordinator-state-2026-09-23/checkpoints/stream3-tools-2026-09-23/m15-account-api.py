"""Private helper for the m15 disposable accounts: login, set names, logout.
Usage: m15-account-api.py <baseline|fixed> names|shape. Never prints secrets."""
import json, sys, urllib.request
R='/private/tmp/pantopus-stream3-20260923-r1'; API='http://127.0.0.1:18130'
acct=json.load(open(R+'/m15-accounts.json'))[sys.argv[1]]
def call(method, path, body=None, tok=None):
    req=urllib.request.Request(API+path, data=json.dumps(body).encode() if body is not None else None, method=method,
        headers={'Content-Type':'application/json', **({'Authorization':'Bearer '+tok} if tok else {})})
    try:
        r=urllib.request.urlopen(req); return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')
st,b=call('POST','/api/users/login',{'email':acct['email'],'password':acct['password']})
print('login', st)
tok=b.get('accessToken') or b.get('access_token')
if sys.argv[2]=='names':
    st,b=call('PATCH','/api/users/profile',{'firstName':'Zeta','lastName':'Tester'},tok); print('patch names', st)
st,b=call('GET','/api/users/profile',None,tok); u=b.get('user',{})
print('profile', st, {'id':u.get('id'),'firstName':u.get('firstName'),'lastName':u.get('lastName')})
st,_=call('POST','/api/users/logout',{},tok); print('logout', st)
