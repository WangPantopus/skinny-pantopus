# Static scan: supabase-js .from('T').select('...') column lists vs the live schema (retained Stream 2 DB).
import json, re, os, sys
ROOT = sys.argv[1]
cols = json.load(open('/private/tmp/pantopus-stream2-r06-runtime/work/schema-columns.json'))
fks = json.load(open('/private/tmp/pantopus-stream2-r06-runtime/work/schema-fks.json'))
fkmap = {}
for t, c, target in fks: fkmap.setdefault(t, {})[c] = target
tables = set(cols)
def split_top(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == ',' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return [x.strip() for x in out if x.strip()]
def check(table, sel, where, issues):
    if table not in tables: return
    for item in split_top(sel):
        item = re.sub(r'\s+', ' ', item)
        if item == '*' or item.startswith('count'): continue
        m = re.match(r'^(?:(\w+):)?([\w!]+)(?:\s*\((.*)\))?$', item, re.S)
        if not m: continue
        alias, name, inner = m.groups()
        name = name.split('::')[0]
        if inner is not None:
            base = name.split('!')[0]
            target = None
            if base in tables: target = base
            elif base in fkmap.get(table, {}): target = fkmap[table][base]
            else:
                hint = name.split('!')[1] if '!' in name else None
                if hint and hint in fkmap.get(table, {}): target = fkmap[table][hint]
            if target is None:
                issues.append((where, table, item[:80], 'embed target unresolved'))
                continue
            check(target, inner, where, issues)
        else:
            c = name.split('->')[0]
            if c not in cols[table]:
                issues.append((where, table, c, 'MISSING COLUMN'))
issues = []
pat = re.compile(r"""\.from\(\s*['"](\w+)['"]\s*\)((?:\s*\.\w+\([^;]*?\))*?)\s*\.select\(\s*(['"`])(.*?)\3""", re.S)
for dp, _, fs in os.walk(ROOT):
    if 'node_modules' in dp or '/tests' in dp: continue
    for f in fs:
        if not f.endswith('.js'): continue
        p = os.path.join(dp, f); src = open(p, encoding='utf8', errors='ignore').read()
        for m in pat.finditer(src):
            table, _, _, sel = m.groups()
            if '${' in sel: continue
            line = src[:m.start()].count('\n') + 1
            check(table, sel, f"{os.path.relpath(p, ROOT)}:{line}", issues)
seen = set()
for w, t, c, kind in issues:
    if kind == 'MISSING COLUMN' and (w, t, c) not in seen:
        seen.add((w, t, c)); print(f"{kind}\t{t}.{c}\t{w}")
print('--- unresolved embeds:', sum(1 for i in issues if i[3] != 'MISSING COLUMN'))
