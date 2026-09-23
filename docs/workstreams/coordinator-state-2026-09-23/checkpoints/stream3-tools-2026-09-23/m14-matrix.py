"""Blocked-viewer visibility matrix against the local API (18130). Prints statuses and
summaries only; tokens come from api.py's private cache and are never printed."""
import json, subprocess, sys, urllib.request
R='/private/tmp/pantopus-stream3-20260923-r1'
DANA='35641fbb-705e-4816-80eb-59fcba589daa'; EVAN='d3671605-b8cc-4e92-8c82-99aa5041ff48'; BOB='c021d181-d7df-4ba9-9e49-fd1cdd6d5548'
def run(fixture, *reqs):
    out=subprocess.run(['python3', R+'/api.py', fixture, *reqs], capture_output=True, text=True, cwd=R).stdout
    rows=[]
    for l in out.splitlines():
        try: j=json.loads(l)
        except Exception: continue
        if 'req' not in j: continue
        b=j.get('body'); s=None
        if isinstance(b,dict) and 'users' in b: s={'results':[u.get('username') for u in b['users']]}
        elif isinstance(b,dict) and 'error' in b: s={'error':b['error']}
        elif isinstance(b,dict): s={'profile':b.get('username') or (b.get('user') or {}).get('username')}
        rows.append({'viewer':fixture,'request':j['req'],'status':j['status'],'summary':s})
    return rows
def anon(path):
    try:
        r=urllib.request.urlopen('http://127.0.0.1:18130'+path); b=json.load(r); return {'viewer':'anonymous','request':'GET '+path,'status':r.status,'summary':{'profile':b.get('username')}}
    except urllib.error.HTTPError as e:
        return {'viewer':'anonymous','request':'GET '+path,'status':e.code,'summary':json.loads(e.read() or b'{}')}
rows=[]
rows+=run('Auth Evan', f'GET /api/users/id/{DANA}', 'GET /api/users/stream3_auth_r3_dana', 'GET /api/users/username/stream3_auth_r3_dana', 'GET /api/users/search?q=Auth&type=people&limit=10', f'GET /api/users/id/{BOB}')
rows+=run('Auth Dana', f'GET /api/users/id/{EVAN}', 'GET /api/users/search?q=Auth&type=people&limit=10')
rows.append(anon(f'/api/users/id/{DANA}'))
label=sys.argv[1] if len(sys.argv)>1 else 'run'
json.dump({'label':label,'rows':rows}, open(f'{R}/m14-matrix-{label}.json','w'), indent=1)
for r in rows: print(r['viewer'], '|', r['request'], '|', r['status'], '|', json.dumps(r['summary']))
