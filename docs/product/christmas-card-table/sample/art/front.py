"""The envelope's address side: red paper, a perforated stamp with printed grain, and an inked postmark cancelling it."""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, rotate, zoom
from common import *

EW, EH = 1200, 1392
rgb = np.load(OUT + 'front-rgb.npy').astype(F)
alpha = np.load(OUT + 'front-a.npy').astype(F)


def perforated(w, h, border, hole_r, pitch):
    """A stamp's paper: white with semicircular bites along every edge."""
    y, x = np.mgrid[0:h, 0:w].astype(F)
    a = np.ones((h, w), F)
    nx = int(round(w / pitch))
    ny = int(round(h / pitch))
    px, py = w / nx, h / ny
    dx = np.abs(((x + px / 2) % px) - px / 2)
    dy = np.abs(((y + py / 2) % py) - py / 2)
    top = np.sqrt(dx ** 2 + y ** 2)
    bot = np.sqrt(dx ** 2 + (h - 1 - y) ** 2)
    lef = np.sqrt(x ** 2 + dy ** 2)
    rig = np.sqrt((w - 1 - x) ** 2 + dy ** 2)
    d = np.minimum(np.minimum(top, bot), np.minimum(lef, rig))
    return smooth(hole_r - 1, hole_r + 1, d)


SW, SH = 214, 272  # stamp size on the envelope, in layer pixels
BORDER = 15
a_w, a_h = SW - 2 * BORDER, SH - 2 * BORDER
SX, SY = EW - SW - 66, 62


def stamp(kind):
    art = Image.open(OUT + f'stamp-{kind}.png').convert('RGB')
    art = np.asarray(art.resize((a_w, a_h), Image.LANCZOS), F) / 255
    # Old printing: colour layers slightly out of register, ink breaking up on the paper.
    art2 = art.copy()
    art2[..., 0] = np.roll(art[..., 0], 1, axis=1)
    art2[..., 2] = np.roll(art[..., 2], -1, axis=0)
    grain = gaussian_filter(rng(5).standard_normal(art.shape[:2]).astype(F), .7)
    grain /= grain.std()
    art2 = art2 * (1 + .035 * grain[..., None])
    speck = smooth(2.6, 3.2, gaussian_filter(rng(6).standard_normal(art.shape[:2]).astype(F), .8) / .35)
    art2 = art2 * (1 - speck[..., None]) + .95 * speck[..., None]
    paper = np.ones((SH, SW, 3), F) * hexrgb('#f6efe0')
    paper *= (1 + .012 * gaussian_filter(rng(7).standard_normal((SH, SW)).astype(F), .9)[..., None] / .4)
    paper[BORDER:BORDER + a_h, BORDER:BORDER + a_w] = art2
    s_alpha = perforated(SW, SH, BORDER, 6.6, 19.5)
    # A touch crooked, with a thin shadow baked in.
    canvas = np.dstack([paper, s_alpha])
    canvas = np.pad(canvas, ((14, 14), (14, 14), (0, 0)))
    rot = np.clip(rotate(canvas, 1.4, axes=(1, 0), reshape=False, order=3), 0, 1)
    al = rot[..., 3]
    sh = np.zeros_like(al)
    sh[3:, 2:] = al[:-3, :-2]
    sh = gaussian_filter(sh, 2.2) * .46
    out_a = al + sh * (1 - al)
    rgb_out = rot[..., :3] * (al / np.maximum(out_a, 1e-4))[..., None]
    save_webp(to_img(rgb_out, out_a), f'stamp-{kind}.webp', q=88, alpha_q=92)


for kind in ('peak', 'fir', 'river'):
    stamp(kind)

# Postmark: uneven, inky, breaking up; it cancels the stamp.
pm = Image.open(OUT + 'postmark.png').convert('RGBA')
PW = 590
pm = pm.resize((PW, PW // 2), Image.LANCZOS).rotate(-7, resample=Image.BICUBIC, expand=True)
pa = np.asarray(pm, F)[..., 3] / 255
ph, pw = pa.shape
press = .78 + .22 * smooth(-1.3, 1.3, fbm(ph, pw, 51, octaves=((60, 1), (30, .6))))
broken = smooth(-1.75, -.95, fbm(ph, pw, 52, octaves=((5, .7), (2.5, 1), (1.2, .7))))
ink = pa * press * broken * .94
ink_rgb = np.ones((ph, pw, 3), F) * np.array([.075, .05, .06], dtype=F)
save_webp(to_img(ink_rgb, ink), 'postmark.webp', q=80, alpha_q=88)
print('postmark size', pw, ph)

save_webp(to_img(rgb, alpha), 'env-front.webp')
