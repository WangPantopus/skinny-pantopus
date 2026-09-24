"""Build the attach set from rendered PNGs: one key image per component + per-board reference PDFs under a size cap.
Usage: python3 package.py docs/design/exports"""
import json, os, re, sys, glob
from PIL import Image
ROOT = sys.argv[1]
CAP = 14 * 1024 * 1024
rep = json.load(open(os.path.join(ROOT, 'render-report.json')))
att = os.path.join(ROOT, 'attach'); os.makedirs(att, exist_ok=True)
by_board = {}
for r in rep: by_board.setdefault(r['board'], []).append(r)
summary = []
for b, rows in sorted(by_board.items()):
    comps = {}
    for r in rows:
        lab = r['label'] or ''
        m = re.match(r'0\d[a-d] · ([A-Za-z]+) · (\d\d)[^·]* · (light|dark)', lab)
        if not m: continue
        c, nn, th = m.groups()
        comps.setdefault(c, []).append((nn, th, r))
    keys = []
    for c, lst in comps.items():
        pick = [x for x in lst if x[0] == '02' and x[1] == 'light'] or [x for x in lst if x[1] == 'light'] or lst
        r = sorted(pick, key=lambda x: x[0])[0][2]
        dst = os.path.join(att, f"{b}-{c}.png")
        Image.open(r['file']).save(dst, optimize=True)
        keys.append((c, os.path.getsize(dst)))
    # reference PDF(s): every artboard in board order, JPEG-compressed, split under CAP
    imgs = [Image.open(r['file']).convert('RGB') for r in sorted(rows, key=lambda r: r['i'])]
    def build(parts_n):
        out = []; per = -(-len(imgs) // parts_n)
        for p in range(parts_n):
            chunk = imgs[p*per:(p+1)*per]
            if not chunk: continue
            fn = os.path.join(att, f"{b}-foundations-reference" + (f"-part{p+1}" if parts_n > 1 else "") + ".pdf")
            chunk[0].save(fn, save_all=True, append_images=chunk[1:], format='PDF', resolution=144, quality=70, optimize=True)
            out.append(fn)
        return out
    n = 1
    while True:
        files = build(n)
        if all(os.path.getsize(f) <= CAP for f in files) or n >= 8: break
        for f in files: os.remove(f)
        n += 1
    summary.append((b, len(rows), sorted(comps), [(os.path.basename(f), round(os.path.getsize(f)/1e6, 1)) for f in files]))
for s in summary: print(s[0], s[1], 'artboards |', len(s[2]), 'components |', s[3])
tot = sum(os.path.getsize(f) for f in glob.glob(os.path.join(att, '*')))
print('attach folder', round(tot/1e6, 1), 'MB,', len(os.listdir(att)), 'files')
