"""All 49 pictures: how each is trimmed to 15:16, which of the four cloth colours its table gets, and its web address name.
Writes designs-table.json and a sheet to check by eye. Reads the full-size crops listed in out/pictures.json."""
import json, re, sys
import numpy as np
from PIL import Image, ImageDraw
from common import *

rows = sorted(json.load(open(OUT + 'pictures.json')), key=lambda r: r['n'])
server = open(sys.argv[1]).read()
block = server[server.index('const DESIGNS = ['):server.index('].map(([caption, paper, height], index)')]
captions = re.findall(r"\['(.*?)', '#[0-9a-f]{6}', \d+\],", block)
assert len(captions) == 49, len(captions)
TARGET = 15 / 16
CLOTH = {'slate': '#3b4c6e', 'dusk': '#2c4071', 'umber': '#6e4b30', 'wine': '#704b51'}
out, cells = [], []
for r, caption in zip(rows, captions):
    im = Image.open(r['file']).convert('RGB')
    w, h = im.size
    # A steady trim of the baked border; the border finder is fooled by snow at the edges, so it never trims past 26.
    left, right = min(r['left'] or 18, 26), min(r['right'] or 18, 26)
    top, bottom = min(r['top'] or 16, 26), min(r['bottom'] or 19, 26)
    left, right, top, bottom = max(left, 12), max(right, 12), max(top, 10), max(bottom, 12)
    crop = im.crop((left, top, w - right, h - bottom))
    cw, ch = crop.size
    if cw / ch > TARGET:
        nw = round(ch * TARGET); off = (cw - nw) // 2; box = (left + off, top, left + off + nw, h - bottom)
    else:
        nh = round(cw / TARGET); off = (ch - nh) // 2; box = (left, top + off, w - right, top + off + nh)
    cut = 1 - (min(cw / ch, TARGET) / max(cw / ch, TARGET))
    pic = im.crop(box)
    a = np.asarray(pic.resize((48, 51), Image.BOX), F) / 255
    lum = float((a * [.299, .587, .114]).sum(axis=2).mean())
    warm = float((a[..., 0] - a[..., 2]).mean())
    # Warm rooms get umber; cold bright snow gets slate; dark blue dusk gets dusk.
    if warm > .10:
        tone = 'umber'
    elif lum < .36:
        tone = 'dusk'
    elif warm > .045:
        tone = 'wine'
    else:
        tone = 'slate'
    slug = re.sub(r'[^a-z0-9]+', '-', caption.lower().replace('’', '')).strip('-')
    out.append({'id': f"christmas-2026-{r['n']:02d}", 'number': r['n'], 'caption': caption, 'slug': slug, 'table': CLOTH[tone], 'tone': tone,
                'crop': list(map(int, box)), 'cut_percent': round(cut * 100, 1), 'lum': round(lum, 3), 'warm': round(warm, 3)})
    cells.append((pic, tone, r['n'], cut))
json.dump({'shape': '15:16', 'cloth': CLOTH, 'designs': out}, open(__file__.rsplit('/', 3)[0] + '/designs-table.json', 'w'), indent=1, ensure_ascii=False)
T = 170
sheet = Image.new('RGB', (T * 10, (T + 34) * 5), (20, 20, 22))
for i, (pic, tone, n, cut) in enumerate(cells):
    x, y = (i % 10) * T, (i // 10) * (T + 34)
    ImageDraw.Draw(sheet).rectangle((x, y, x + T - 2, y + T + 32), fill=tuple(int(CLOTH[tone][k:k + 2], 16) for k in (1, 3, 5)))
    p = pic.copy(); p.thumbnail((T - 26, T - 8))
    sheet.paste(p, (x + 12, y + 6))
    ImageDraw.Draw(sheet).text((x + 12, y + T + 2), f'{n} {tone} cut {cut*100:.1f}%', fill=(255, 240, 200))
sheet.save(OUT + 'all-49.jpg', quality=84)
from collections import Counter
print(Counter(c[1] for c in cells), sheet.size)
print('worst cuts', sorted([(round(c[3]*100,1), c[2]) for c in cells], reverse=True)[:8])
