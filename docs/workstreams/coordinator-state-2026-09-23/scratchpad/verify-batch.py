#!/usr/bin/env python3
"""Verify a combined merge batch built by build-batch.sh.

usage: verify-batch.py <base-ref> <tip> <pr>=<head> [<pr>=<head> ...]
Run it from any checkout of the repo that has the objects (fetch refs/remotes/pr/<n> first).

Checks:
  1. ancestry: the tip contains the base and every head;
  2. file-set union: base..tip changes exactly the union of the PRs' own files
     (each PR diffed from its merge-base with the base);
  3. single-PR files: the tip's blob equals that PR head's blob;
  4. shared files: every PR's hunks for that file reverse-apply to the tip version
     (`patch -R --dry-run`), so each PR's change is present.
Exit status 0 only if every check passes.
"""
import subprocess, sys, tempfile, os

def git(*args, check=True):
    r = subprocess.run(['git', *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout

base = git('rev-parse', sys.argv[1]).strip()
tip = git('rev-parse', sys.argv[2]).strip()
prs = []
for a in sys.argv[3:]:
    n, h = a.split('=', 1)
    prs.append((n, git('rev-parse', h).strip()))

ok = True
def fail(msg):
    global ok
    ok = False
    print('FAIL', msg)

# 1. ancestry
for ref, label in [(base, 'base')] + [(h, f'#{n}') for n, h in prs]:
    if subprocess.run(['git', 'merge-base', '--is-ancestor', ref, tip]).returncode != 0:
        fail(f'tip does not contain {label} {ref[:9]}')
print('ancestry: checked', 1 + len(prs), 'refs')

# 2. file sets
files_by_pr = {}
for n, h in prs:
    mb = git('merge-base', base, h).strip()
    files_by_pr[n] = (mb, set(filter(None, git('diff', '--name-only', mb, h).split('\n'))))
union = set().union(*[f for _, f in files_by_pr.values()]) if prs else set()
tipfiles = set(filter(None, git('diff', '--name-only', base, tip).split('\n')))
if union != tipfiles:
    fail(f'file set differs: only in tip {sorted(tipfiles - union)[:10]}, only in PRs {sorted(union - tipfiles)[:10]}')
print('file-set union:', len(union), 'files; tip changes', len(tipfiles))

# 3/4. per file
owners = {}
for n, (_, fs) in files_by_pr.items():
    for f in fs:
        owners.setdefault(f, []).append(n)
heads = dict(prs)
shared = 0
for f, ns in sorted(owners.items()):
    tip_blob = git('rev-parse', f'{tip}:{f}', check=False).strip()
    if len(ns) == 1:
        head_blob = git('rev-parse', f'{heads[ns[0]]}:{f}', check=False).strip()
        if tip_blob != head_blob:
            fail(f'{f}: tip blob != #{ns[0]} head blob')
        continue
    shared += 1
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, 'file')
        content = subprocess.run(['git', 'show', f'{tip}:{f}'], capture_output=True).stdout
        open(path, 'wb').write(content)
        for n in ns:
            mb = files_by_pr[n][0]
            diff = subprocess.run(['git', 'diff', mb, heads[n], '--', f], capture_output=True).stdout
            r = subprocess.run(['patch', '-R', '--dry-run', '-p1', '-s', '-f', '-d', d, '-i', '-'],
                               input=diff.replace(f'a/{f}'.encode(), b'a/file').replace(f'b/{f}'.encode(), b'b/file'),
                               capture_output=True)
            if r.returncode != 0:
                fail(f'{f}: #{n} hunks do not reverse-apply to the tip ({r.stdout.decode()[:120]} {r.stderr.decode()[:120]})')
        print(f'shared file {f}: PRs {", ".join("#" + n for n in ns)} checked')
print('single-PR files:', len(owners) - shared, '| shared files:', shared)
print('RESULT', 'OK' if ok else 'FAILED')
sys.exit(0 if ok else 1)
