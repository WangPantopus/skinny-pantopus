#!/usr/bin/env python3
# seal.py <bundle_dir> <branch> <commit> <boundary text>
import hashlib, json, os, sys, subprocess, datetime
d, branch, commit, boundary = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
files = []
for root, _, names in os.walk(d):
    for n in sorted(names):
        if n == 'MANIFEST.json': continue
        p = os.path.join(root, n)
        rel = os.path.relpath(p, d)
        data = open(p, 'rb').read()
        files.append({'path': rel, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)})
files.sort(key=lambda f: f['path'])
updated = subprocess.check_output(['date', '-u', '+%Y-%m-%dT%H:%M:%SZ']).decode().strip()
m = {'updatedAt': updated, 'branch': branch, 'commit': commit, 'boundary': boundary, 'files': files}
open(os.path.join(d, 'MANIFEST.json'), 'w').write(json.dumps(m, indent=2) + '\n')
print(hashlib.sha256(open(os.path.join(d, 'MANIFEST.json'), 'rb').read()).hexdigest(), len(files), 'files', updated)
