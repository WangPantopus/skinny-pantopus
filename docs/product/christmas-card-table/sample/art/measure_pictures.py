"""Measure all 49 full-size pictures: size, baked border, photo shape, and how much a common shape would cut."""
import glob, json, os, re
import numpy as np
from PIL import Image

D = os.path.expanduser('~/Downloads/')
files = sorted(glob.glob(D + 'christmasthanksgiving-cropped/*.png')) + sorted(glob.glob(D + 'christmas-collections-cropped/*/*.png'))
rows = []
for f in files:
    n = int(re.match(r'(\d+)', os.path.basename(f)).group(1))
    im = Image.open(f).convert('RGB')
    a = np.asarray(im, np.float32)
    h, w, _ = a.shape
    paper = np.median(np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)]), axis=0)
    close = (np.abs(a - paper).max(axis=2) < 26)
    def edge(fracs):
        limit = int(len(fracs) * .2)
        for i, v in enumerate(fracs[:limit]):
            if v < .55:
                return i
        return limit
    left = edge(close.mean(axis=0))
    right = edge(close.mean(axis=0)[::-1])
    top = edge(close.mean(axis=1))
    bottom = edge(close.mean(axis=1)[::-1])
    pw, ph = w - left - right, h - top - bottom
    rows.append(dict(n=n, file=f, w=w, h=h, left=left, right=right, top=top, bottom=bottom, pw=pw, ph=ph, ratio=pw / ph))
rows.sort(key=lambda r: r['n'])
print('pictures', len(rows), 'sizes', sorted({(r['w']) for r in rows}))
print('full shape w/h: min %.3f max %.3f' % (min(r['w'] / r['h'] for r in rows), max(r['w'] / r['h'] for r in rows)))
print('heights', min(r['h'] for r in rows), max(r['h'] for r in rows))
print('border px L/R/T/B median', *(int(np.median([r[k] for r in rows])) for k in ('left', 'right', 'top', 'bottom')))
rat = np.array([r['ratio'] for r in rows])
print('photo w/h inside border: min %.3f median %.3f max %.3f' % (rat.min(), np.median(rat), rat.max()))
for name, target in (('10:11', 10 / 11), ('15:16', 15 / 16), ('19:20', .95), ('1:1', 1.0), ('4:5', .8)):
    cut = []
    for r in rows:
        if r['ratio'] > target:
            cut.append(('width', 1 - target / r['ratio']))
        else:
            cut.append(('height', 1 - r['ratio'] / target))
    vals = np.array([c[1] for c in cut])
    print(f'{name}: worst cut {vals.max()*100:.1f}%  median {np.median(vals)*100:.1f}%  over 4%: {(vals>.04).sum()}  over 6%: {(vals>.06).sum()}')
print('n  size       border(L,R,T,B)  photo     w/h')
for r in rows:
    print(f"{r['n']:2d} {r['w']}x{r['h']}  {r['left']:3d},{r['right']:3d},{r['top']:3d},{r['bottom']:3d}  {r['pw']}x{r['ph']}  {r['ratio']:.3f}")
json.dump(rows, open(__file__.rsplit('/', 1)[0] + '/out/pictures.json', 'w'))
