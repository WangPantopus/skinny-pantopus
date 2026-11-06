# apply.py CLASSES UPDATES...: replace rank-keyed lines of a classes.txt with rows from update files (atomic write)
import sys, os
path = sys.argv[1]
lines = open(path).read().splitlines()
upd = {}
for f in sys.argv[2:]:
    for l in open(f).read().splitlines():
        if l.strip():
            assert l.count("|") == 4, l
            upd[l.split("|")[0]] = l
out, seen = [], set()
for l in lines:
    k = l.split("|")[0]
    if k in upd:
        print("- " + l[:110]); print("+ " + upd[k][:110]); out.append(upd[k]); seen.add(k)
    else:
        out.append(l)
missing = set(upd) - seen
assert not missing, "ranks not in file: %s" % sorted(missing)
open(path + ".tmp", "w").write("\n".join(out) + "\n"); os.replace(path + ".tmp", path)
print("updated", len(seen), "rows in", path)
