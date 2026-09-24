"""Build pack-manifest.json from the final prompt texts + metadata. Usage: python3 build_manifest.py [prompts_dir]"""
import json, os, re, sys
N = os.path.dirname(os.path.abspath(__file__))
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(N, 'prompts-final')
def body(path):
    t = open(path).read()
    parts = t.split('\n\n', 1)             # strip our 2-line header
    return parts[1].strip() if t.startswith('# ') and len(parts) == 2 else t.strip()
def grab(t, label, maxlen=260):
    m = re.search(r'^\s*' + label + r'\s*[:—-]\s*(.+)$', t, re.M) or re.search(r'^\s*' + label + r'\s*$\n+\s*(.+)$', t, re.M)
    if not m: return ''
    s = m.group(1).strip()
    return s if len(s) <= maxlen else s[:maxlen].rsplit(' ', 1)[0] + '…'
inv = {}
for f in os.listdir(os.path.join(N, 'inventory-entries')):
    e = json.load(open(os.path.join(N, 'inventory-entries', f))); inv[e['id']] = e
v2 = {p['id']: p for p in json.load(open(os.path.join(N, 'design-prompts-v2.json')))}
order = [l.split(' | ')[0] for l in open(os.path.join(N, 'surface-index.txt')).read().splitlines()]
fnd = json.load(open(os.path.join(N, 'workflow-outputs', 'c1b-foundations-split.output')))['result']
fmeta = {}
for s in fnd['splits']:
    if not s: continue
    fmeta[s['setup']['id']] = {'name': 'Board setup', 'artboards': 0}
    for c in s['components']: fmeta[c['id']] = {'name': c['component'], 'artboards': len(c['artboards'])}
CONTRACT = {c['name']: c for c in json.load(open(os.path.join(N, 'component-contract.json')))['components']}
BOARD = {'00a': 'Marks, captions and chips', '00b': 'Data instruments', '00c': 'Rows and lists', '00d': 'States, feedback and asks'}
flows = {}
fp = os.path.join(N, 'workflow-outputs', 'c2a-flows.json')
if os.path.exists(fp):
    for b in json.load(open(fp))['flows']:
        for p in b['prompts']: flows[p['id']] = p
PH = {'loop': 'Before the pilot', 'pilot': 'At the pilot', 'phase2': 'After the first read'}
def count_artboards(t):
    m = re.search(r'ARTBOARDS[^\n]*\n(.*?)(?:\n\s*BATCH PLAN|\Z)', t, re.S)
    seg = m.group(1) if m else ''
    return len(re.findall(r'^\s*\d+[\.\)]\s', seg, re.M))
items = []
for extra in sorted(f[:-3] for f in os.listdir(D) if re.match(r'00[a-d]-\d\d[a-z]$', f[:-3])):
    fmeta.setdefault(extra, {'name': fmeta.get(extra[:-1], {}).get('name', '?') + ' (part 2 of 2)', 'artboards': 0})
for i in sorted(fmeta):
    p = os.path.join(D, f'{i}.md')
    if not os.path.exists(p): continue
    t = body(p); b = i[:3]
    items.append({'id': i, 'section': 'foundations', 'group': f'{b} · {BOARD[b]}', 'name': fmeta[i]['name'], 'platforms': ['web', 'ios', 'android'],
                  'type': 'Setup' if i.endswith('-00') else 'Component', 'artboards': fmeta[i]['artboards'] or count_artboards(t),
                  'job': ('Part 2 of 2: send right after ' + i[:-1] + ' in the same project. Adds the remaining artboards, the dark twins and the Notes entries.' if re.search(r'[a-z]$', i) else '') or (CONTRACT.get(fmeta[i]['name'], {}).get('purpose', '')) or ('Board rules for every component on this board. Send first; draws nothing.' if i.endswith('-00') else ''),
                  'attach': grab(t, 'ATTACH'), 'text': t})
for i in order:
    p = os.path.join(D, f'{i}.md')
    if not os.path.exists(p): continue
    t = body(p); m = v2[i]; e = inv[i]
    items.append({'id': i, 'section': 'screens', 'group': PH.get(e.get('phase'), e.get('phase')), 'name': m['name'], 'platforms': m['platforms'],
                  'type': 'New' if m['isNew'] else 'Extend', 'artboards': count_artboards(t) or m['frameCount'],
                  'job': grab(t, 'THE ONE JOB'), 'attach': grab(t, 'ATTACH'), 'disposition': e['disposition'], 'text': t})
for i in sorted(flows):
    p = os.path.join(D, f'{i}.md')
    if not os.path.exists(p): continue
    t = body(p); m = flows[i]
    nm = re.sub(r'^(?:flow-\d\d\s*·\s*|Journey storyboard:\s*|Storyboard:\s*)', '', m['name'])
    nm = re.sub(r'\s*\((?:journey storyboard)\)\s*$', '', nm).strip()
    arts = len(set(re.findall(i + r' · storyboard · (\d{2}[a-z]?)', t))) or None
    items.append({'id': i, 'section': 'journeys', 'group': 'Journey storyboards', 'name': nm, 'platforms': m['platforms'],
                  'type': 'Storyboard', 'artboards': arts or count_artboards(t) or m['frameCount'],
                  'job': grab(t, 'GOAL') or grab(t, 'PERSONA & SITUATION'), 'attach': grab(t, 'ATTACH'), 'surfaces': m.get('surfacesTouched', []), 'text': t})
json.dump(items, open(os.path.join(N, 'pack-manifest.json'), 'w'), indent=1)
from collections import Counter
print(len(items), 'items', dict(Counter(x['section'] for x in items)), 'artboards', sum(x['artboards'] for x in items),
      'words', sum(len(x['text'].split()) for x in items), '| missing job:', [x['id'] for x in items if not x['job']][:12])
