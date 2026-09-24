import json, sys, os
wf = sys.argv[1]
out = sys.argv[2]
recs = []
for line in open(os.path.join(wf,'journal.jsonl')):
    try: d = json.loads(line)
    except: continue
    if d.get('type') == 'result':
        recs.append(d)
# label lookup from agent meta files
def label_for(aid):
    p = os.path.join(wf, f'agent-{aid}.meta.json')
    if os.path.exists(p):
        try:
            m = json.load(open(p))
            return m.get('label') or m.get('name') or aid
        except: pass
    return aid
blob = {}
for r in recs:
    aid = r.get('agentId')
    blob[label_for(aid)] = r.get('result')
json.dump(blob, open(out,'w'), indent=1)
print(f'wrote {len(blob)} results ->', out)
for k in blob: print(' -', k)
