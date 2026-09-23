#!/bin/bash
# ios.sh shot <name> | tree <name> | flow <file.yaml> [-e K=V...]
U=C08F0148-B19A-4DEF-80E5-5856F90169C3
R=/private/tmp/pantopus-shared-ux-runtime
export PATH=$R/tools/maestro/bin:$PATH
case "$1" in
  shot) xcrun simctl io $U screenshot "$R/shots/$2.png" >/dev/null 2>&1 && sips -Z 700 "$R/shots/$2.png" --out "$R/shots/$2-small.png" >/dev/null && echo "$R/shots/$2-small.png";;
  tree) maestro --device $U hierarchy > "$R/shots/$2.json" 2>/dev/null; python3 - "$R/shots/$2.json" <<'PY'
import json,sys
raw=open(sys.argv[1]).read()
i=raw.find('{'); d=json.loads(raw[i:])
out=[]
def walk(n,depth=0):
    a=n.get('attributes',{})
    t=(a.get('accessibilityText') or '').strip(); tx=(a.get('text') or '').strip(); rid=(a.get('resource-id') or '').strip()
    b=a.get('bounds','')
    lab=' | '.join(x for x in [tx,t] if x)
    if lab or rid:
        out.append(f"{lab}  [{rid}] {b}".strip())
    for c in n.get('children',[]): walk(c,depth+1)
walk(d)
seen=set()
for l in out:
    if l not in seen:
        seen.add(l); print(l)
PY
  ;;
  flow) shift; f="$1"; shift; maestro --device $U test "$@" "$f" 2>&1 | grep -v "^$" | tail -30;;
esac
