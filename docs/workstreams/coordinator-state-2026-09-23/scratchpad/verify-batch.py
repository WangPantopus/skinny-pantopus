#!/usr/bin/env python3
"""Verify a combined merge batch built by build-batch.sh.

usage: verify-batch.py <base-ref> <tip> <pr>=<head> [<pr>=<head> ...]
Run it from any checkout of the repo that has the objects (fetch refs/remotes/pr/<n> first).

Checks:
  1. ancestry: the tip contains the base and every head;
  2. file-set union: base..tip changes exactly the union of the PRs' own files
     (each PR diffed from its merge-base with the base);
  3. fast path: a file only one PR touches, unchanged on the base since that PR's merge-base,
     equals that PR head's blob;
  4. every other file (shared by several PRs, or also changed on the base since a PR's
     merge-base): starting from the tip's version, reverse-apply each touching PR's own diff
     (last merged first, `patch -R -F0`) and require the result to equal the base's version,
     so the tip is exactly the base plus those PRs' hunks.
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

# 3/4. per file. Fast path: a file only one PR touches, unchanged on the base since that PR's
# merge-base, must equal the PR head's blob. Otherwise prove it exactly: starting from the tip's
# version, reverse-apply every touching PR's own diff (last merged first, no fuzz) and require
# the result to equal the base's version, so tip == base + exactly those PRs' hunks.
owners = {}
order = [n for n, _ in prs]
for n, (_, fs) in files_by_pr.items():
    for f in fs:
        owners.setdefault(f, []).append(n)
heads = dict(prs)
proved = 0
for f, ns in sorted(owners.items()):
    ns = sorted(ns, key=order.index)
    tip_blob = git('rev-parse', f'{tip}:{f}', check=False).strip()
    if len(ns) == 1:
        mb = files_by_pr[ns[0]][0]
        head_blob = git('rev-parse', f'{heads[ns[0]]}:{f}', check=False).strip()
        base_changed = subprocess.run(['git', 'diff', '--quiet', mb, base, '--', f]).returncode != 0
        if tip_blob == head_blob and not base_changed:
            continue
    proved += 1
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, 'file')
        tip_bytes = subprocess.run(['git', 'show', f'{tip}:{f}'], capture_output=True)
        base_bytes = subprocess.run(['git', 'show', f'{base}:{f}'], capture_output=True)
        open(path, 'wb').write(tip_bytes.stdout if tip_bytes.returncode == 0 else b'')
        good = True
        for n in reversed(ns):
            mb = files_by_pr[n][0]
            diff = subprocess.run(['git', 'diff', mb, heads[n], '--', f], capture_output=True).stdout
            diff = diff.replace(f'a/{f}'.encode(), b'a/file').replace(f'b/{f}'.encode(), b'b/file')
            r = subprocess.run(['patch', '-R', '-p1', '-s', '-f', '-F0', '-d', d, '-i', '-'], input=diff, capture_output=True)
            if r.returncode != 0:
                fail(f'{f}: #{n} hunks do not reverse-apply exactly ({(r.stdout + r.stderr).decode()[:160]})')
                good = False
                break
        if good:
            got = open(path, 'rb').read() if os.path.exists(path) else b''
            want = base_bytes.stdout if base_bytes.returncode == 0 else b''
            if got != want:
                fail(f'{f}: tip minus PRs {", ".join("#" + n for n in ns)} != base version')
            else:
                print(f'proved {f}: tip == base + {", ".join("#" + n for n in ns)}')
print('files:', len(owners), '| blob-equal fast path:', len(owners) - proved, '| exact hunk proofs:', proved)
print('RESULT', 'OK' if ok else 'FAILED')
sys.exit(0 if ok else 1)
