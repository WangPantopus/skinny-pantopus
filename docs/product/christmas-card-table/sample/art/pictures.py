"""Each sample picture: trimmed to one shared shape (15:16, no baked border), and the table it lies on, tinted from it."""
import json
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from common import *

rows = {r['n']: r for r in json.load(open(OUT + 'pictures.json'))}
# number, how to place the crop (0 top .. 1 bottom), paper
PICKS = {8: (.30, '#f9f1e3'), 1: (.40, '#f7eee0'), 24: (.5, '#f9f1df')}
MOODS = {'8': hexrgb('3b4c6e'), '1': hexrgb('2c4071'), '24': hexrgb('6e4b30')}
import sys
SUFFIX = ''
for arg in sys.argv[1:]:
    k, v = arg.split('=')
    if k == 'suffix':
        SUFFIX = v
    else:
        MOODS[k] = hexrgb(v)
TARGET = 15 / 16
TW, TH = 1290, 2240


def weave(h, w, seed, pitch=5.2):
    """A fine linen cloth as a height map."""
    y, x = np.mgrid[0:h, 0:w].astype(F)
    r = rng(seed)
    wob1 = gaussian_filter(r.standard_normal((h, w)).astype(F), (1, 40))
    wob2 = gaussian_filter(r.standard_normal((h, w)).astype(F), (40, 1))
    wob1 /= wob1.std()
    wob2 /= wob2.std()
    warp = np.sin(2 * np.pi * x / pitch + .9 * wob2)
    weft = np.sin(2 * np.pi * y / pitch + .9 * wob1)
    thick1 = 1 + .35 * gaussian_filter(r.standard_normal((h, w)).astype(F), (60, .8)) / .03
    thick2 = 1 + .35 * gaussian_filter(r.standard_normal((h, w)).astype(F), (.8, 60)) / .03
    over = np.sign(np.sin(np.pi * x / pitch) * np.sin(np.pi * y / pitch))
    H = (warp * thick1.clip(.3, 1.8) * (over > 0) + weft * thick2.clip(.3, 1.8) * (over <= 0))
    return gaussian_filter(H, .7)


for n, (focus, paper) in PICKS.items():
    r = rows[n]
    im = Image.open(r['file']).convert('RGB')
    # Fix the two pictures the border finder over-read: use a steady small trim for the sample.
    trim_x = 18
    trim_top, trim_bottom = 16, 19
    box = (trim_x, trim_top, r['w'] - trim_x, r['h'] - trim_bottom)
    im = im.crop(box)
    w, h = im.size
    if w / h > TARGET:
        nw = int(round(h * TARGET))
        off = (w - nw) // 2
        im = im.crop((off, 0, off + nw, h))
    else:
        nh = int(round(w / TARGET))
        off = int(round((h - nh) * focus))
        im = im.crop((0, off, w, off + nh))
    print(n, 'trimmed from', r['w'], r['h'], 'to', im.size)
    im.save(A + f'card-{n:02d}.jpg', quality=88, optimize=True, progressive=True)
    im.resize((96, 102), Image.LANCZOS).save(A + f'thumb-{n:02d}.jpg', quality=78)

    # The table: a deep cloth in a colour taken from the picture, with a little of the picture's own spread of colour.
    a = np.asarray(im.resize((72, 77), Image.BOX), F) / 255
    px = a.reshape(-1, 3)
    # A small k-means to find the picture's main colours.
    r_ = rng(n)
    centers = px[r_.choice(len(px), 7, replace=False)]
    for _ in range(14):
        d2 = ((px[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        lab = d2.argmin(axis=1)
        for k in range(7):
            if (lab == k).any():
                centers[k] = px[lab == k].mean(axis=0)
    counts = np.bincount(lab, minlength=7).astype(F)
    sat = centers.max(axis=1) - centers.min(axis=1)
    val = centers.max(axis=1)
    # Favour colours with real hue that aren't near-white snow or near-black.
    score = counts * (sat + .04) * smooth(.97, .5, val) * smooth(.05, .22, val)
    mood = MOODS.get(str(n), centers[score.argmax()])
    print('  mood', (mood * 255).astype(int), 'all', (centers * 255).astype(int).tolist())
    # Deep and rich, whatever the picture's brightness.
    lum = float((mood * [.299, .587, .114]).sum())
    deep = lum + (mood - lum) * 1.12
    deep = np.clip(deep, .002, None)
    deep = deep * (.135 / float((deep * [.299, .587, .114]).sum()))
    # The picture's colours, softly, for a little life across the cloth.
    small = Image.fromarray((a * 255).astype(np.uint8)).resize((TW // 4, TH // 4), Image.BICUBIC)
    amb = gaussian_filter(np.asarray(small, F) / 255, (60, 60, 0))
    amb = amb / amb.mean(axis=(0, 1), keepdims=True)
    amb = np.asarray(Image.fromarray(np.uint8(np.clip(amb * .5, 0, 1) * 255)).resize((TW, TH), Image.BICUBIC), F) / 255 * 2
    amb = deep[None, None, :] * (1 + .22 * (amb - 1))
    # Pool of light from the top left, falling off to the corners.
    y, x = np.mgrid[0:TH, 0:TW].astype(F)
    u, v = x / TW, y / TH
    d = np.sqrt(((u - .42) / .85) ** 2 + ((v - .36) / .78) ** 2)
    pool = 1.42 - 1.05 * smooth(0, 1.05, d)
    W_ = weave(TH, TW, 70 + n)
    shade = 1 + .05 * W_
    rgb = amb * pool[..., None] * shade[..., None]
    # Noise so the dark gradient never bands.
    rgb += (rng(90 + n).standard_normal((TH, TW)).astype(F) * .006)[..., None]
    Image.fromarray((np.clip(rgb, 0, 1) * 255 + .5).astype(np.uint8)).save(('../testtables/' if SUFFIX else A) + f'table-{n:02d}' + (('-' + SUFFIX) if SUFFIX else '') + '.jpg', quality=78, optimize=True, progressive=True)
    import os
    print(' table', 0, 'KB', ' card', os.path.getsize(A + f'card-{n:02d}.jpg') // 1024, 'KB')

# Morning light through a window, falling across everything: a soft-edged set of panes.
LW, LH = 720, 1280
im = Image.new('L', (LW * 2, LH * 2), 0)
from PIL import ImageDraw
d = ImageDraw.Draw(im)
# Panes in the light's own plane, then sheared across the page.
cols, rows_ = 3, 4
pw, ph = 330, 360
gap = 34
x0, y0 = -160, -220
shear = .52
for c in range(cols):
    for r_ in range(rows_):
        px = x0 + c * (pw + gap)
        py = y0 + r_ * (ph + gap)
        quad = [(px, py), (px + pw, py), (px + pw, py + ph), (px, py + ph)]
        q = [(LW + (qx - 300) * .86 - (qy) * shear * .42, 220 + qy * .92 + (qx - 300) * shear) for qx, qy in quad]
        d.polygon(q, fill=255)
m = np.asarray(im.resize((LW, LH), Image.LANCZOS), F) / 255
m = gaussian_filter(m, 10)
falloff = np.asarray(Image.fromarray(np.uint8(255 * np.clip(1.15 - np.sqrt(((np.mgrid[0:LH, 0:LW][1] / LW - .55) / 1.0) ** 2 + ((np.mgrid[0:LH, 0:LW][0] / LH - .42) / .8) ** 2), 0, 1))), F) / 255
col = np.ones((LH, LW, 3), F) * np.array([1, .91, .76], dtype=F)
save_webp(to_img(col, m * falloff), 'light.webp', q=60, alpha_q=70)
