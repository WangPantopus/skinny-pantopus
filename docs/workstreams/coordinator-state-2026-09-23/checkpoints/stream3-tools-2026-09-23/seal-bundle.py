#!/usr/bin/env python3
"""seal-bundle.py <bundle-dir> <branch> <commit> <boundary>: scan for secrets, write MANIFEST.json, print its sha256."""
import hashlib, json, os, re, subprocess, sys
D, branch, commit, boundary = sys.argv[1:5]
pat = re.compile(rb'sk_test_|pk_test_|sk_live_|whsec_|eyJhbGci')
hits = []
files = {}
for root, _, names in os.walk(D):
    for n in sorted(names):
        p = os.path.join(root, n)
        rel = os.path.relpath(p, D)
        if rel == 'MANIFEST.json':
            continue
        data = open(p, 'rb').read()
        if pat.search(data):
            hits.append(rel)
        files[rel] = {'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}
if hits:
    print('SECRET PATTERN FOUND in', hits); sys.exit(1)
now = subprocess.run(['date', '-u', '+%FT%TZ'], capture_output=True, text=True).stdout.strip()
m = {'updatedAt': now, 'branch': branch, 'commit': commit, 'boundary': boundary, 'files': dict(sorted(files.items()))}
with open(os.path.join(D, 'MANIFEST.json'), 'w') as f:
    json.dump(m, f, indent=1); f.write('\n')
print('scan clean;', len(files), 'files; MANIFEST sha256', hashlib.sha256(open(os.path.join(D, 'MANIFEST.json'), 'rb').read()).hexdigest())
