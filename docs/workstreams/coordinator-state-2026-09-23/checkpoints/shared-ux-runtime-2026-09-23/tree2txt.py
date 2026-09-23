import json,sys
raw=open(sys.argv[1]).read()
i=raw.find('{'); d=json.loads(raw[i:])
out=[]
def walk(n):
    a=n.get('attributes',{})
    t=(a.get('accessibilityText') or '').strip(); tx=(a.get('text') or '').strip(); rid=(a.get('resource-id') or '').strip()
    b=a.get('bounds','')
    lab=' | '.join(x for x in [tx,t] if x)
    if lab or rid:
        out.append(f"{lab}  [{rid}] {b}".strip())
    for c in n.get('children',[]): walk(c)
walk(d)
seen=set()
for l in out:
    if l in seen: continue
    seen.add(l)
    if any(k in l for k in ['Wi-Fi','battery','Cellular',' AM  []',' PM  []']): continue
    print(l)
