#!/usr/bin/env python3
"""create-full-check.py <api-base> <label>: POST /api/businesses/create-full with an invalid then a valid business_type (as Auth Bob);
soft-deletes any business created through the product's DELETE route. Prints statuses and error text only."""
import json, sys, os, time
os.environ['STREAM3_API'] = sys.argv[1]
import importlib.util
spec = importlib.util.spec_from_file_location('api', '/private/tmp/pantopus-stream3-20260923-r1/api.py'); api = importlib.util.module_from_spec(spec); spec.loader.exec_module(api)
tok = api.cached_token('Auth Bob')[0]
out = []
stamp = str(int(time.time()))[-6:]
for label, btype in [('invalid', 'not_a_type'), ('valid', 'nonprofit_501c3')]:
    body = {'username': f'stream3_cf_{label}_{stamp}', 'name': f'Stream3 CF {label} {stamp}', 'email': f'stream3-cf-{label}-{stamp}@example.com', 'business_type': btype}
    st, raw = api.call('POST', '/api/businesses/create-full', body, tok)
    try: j = json.loads(raw)
    except Exception: j = {'raw': raw[:200]}
    bid = (j.get('business') or {}).get('id') or j.get('business_id') or (j.get('businessUserId'))
    rec = {'case': label, 'business_type': btype, 'status': st, 'error': j.get('error'), 'created_id_prefix': (bid or '')[:8]}
    if bid:
        dst, _ = api.call('DELETE', f'/api/businesses/{bid}', None, tok); rec['cleanup_delete_status'] = dst
    out.append(rec)
print(json.dumps({'label': sys.argv[2], 'steps': out}, indent=1))
