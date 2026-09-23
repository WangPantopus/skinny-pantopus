#!/usr/bin/env python3
"""Stream 2 bundle sealer: secret-scan text files, then write MANIFEST.json (sha256 + size per file).
Usage: seal-s2.py <bundle-dir> <branch> <commit> <boundary...>
updatedAt comes from the UTC clock at write time."""
import datetime, hashlib, json, os, re, sys

bundle, branch, commit = sys.argv[1], sys.argv[2], sys.argv[3]
boundary = " ".join(sys.argv[4:])
SECRET = [
    (re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'), 'JWT'),
    (re.compile(r'\bsk_(live|test)_[A-Za-z0-9]{8,}'), 'Stripe key'),
    (re.compile(r'(?i)bearer\s+[A-Za-z0-9._-]{20,}'), 'bearer token'),
    (re.compile(r'(?i)"?(password|passwd|secret|service_role_key|api_key)"?\s*[:=]\s*"?[^\s",<]{6,}'), 'credential assignment'),
    (re.compile(r'[A-Za-z0-9._%+-]+@(example\.com|gmail\.com)'), 'email address'),
]
problems, files = [], []
for root, _, names in os.walk(bundle):
    for n in sorted(names):
        p = os.path.join(root, n)
        rel = os.path.relpath(p, bundle)
        if rel == 'MANIFEST.json':
            continue
        data = open(p, 'rb').read()
        if not n.lower().endswith(('.png', '.jpg', '.jpeg', '.apk')):
            text = data.decode('utf-8', 'replace')
            for rx, label in SECRET:
                for m in rx.finditer(text):
                    # A harness reading a credential from its env file (password: c.password) is code, not a secret.
                    if label == 'credential assignment' and re.search(r'[:=]\s*"?[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\)?\s*[,}]?$', m.group(0)):
                        continue
                    problems.append(f'{rel}: {label}: {m.group(0)[:12]}...')
        files.append({'path': rel, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)})
if problems:
    print('SECRET SCAN FAILED:')
    print('\n'.join(problems))
    sys.exit(1)
files.sort(key=lambda f: f['path'])
manifest = {
    'updatedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'branch': branch,
    'commit': commit,
    'boundary': boundary,
    'files': files,
}
out = os.path.join(bundle, 'MANIFEST.json')
with open(out, 'w') as fh:
    json.dump(manifest, fh, indent=2)
    fh.write('\n')
print(f'secret scan clean; {len(files)} files')
print(hashlib.sha256(open(out, 'rb').read()).hexdigest(), 'MANIFEST.json')
