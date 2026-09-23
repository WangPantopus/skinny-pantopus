import hashlib, json, os, sys, subprocess
bundle, branch, commit, boundary = sys.argv[1:5]
extra = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
updated = subprocess.check_output(['date', '-u', '+%Y-%m-%dT%H:%M:%SZ']).decode().strip()
files = {}
for root, _, names in os.walk(bundle):
    for n in sorted(names):
        p = os.path.join(root, n)
        rel = os.path.relpath(p, bundle)
        if rel == 'MANIFEST.json' or n == '.DS_Store':
            continue
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        files[rel] = {'sha256': h, 'size': os.path.getsize(p)}
m = {'updatedAt': updated, 'branch': branch, 'commit': commit, 'boundary': boundary}
m.update(extra)
m['files'] = dict(sorted(files.items()))
out = os.path.join(bundle, 'MANIFEST.json')
json.dump(m, open(out, 'w'), indent=1)
open(out, 'a').write('\n')
print(updated, len(files), hashlib.sha256(open(out, 'rb').read()).hexdigest())
