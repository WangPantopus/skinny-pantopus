"""Card stock: a seamless light paper grain to lay over the card with multiply."""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from common import *

S = 512
G = 256
fib = gaussian_filter(fibers(S, S, 5200, 61, lo=8, hi=46, wrap=True), .55, mode='wrap')
fine = gaussian_filter(rng(62).standard_normal((S, S)).astype(F), .75, mode='wrap')
fine /= fine.std()
mott = fbm(S, S, 63, octaves=((40, 1), (18, .5), (8, .3)), wrap=True)
H = .9 * fib + .32 * fine
gy, gx = np.gradient(H)
# Lit from the top left, wrapped by keeping it tile-safe through small kernels.
shade = 1 - .55 * (gx * .46 + gy * .6)
tone = shade * (1 + .010 * mott)
tone = tone / np.percentile(tone, 99)
img = 1 - (1 - np.clip(tone, .78, 1.0)) * .42
rgb = np.dstack([img, img * .995, img * .985])
to_img(rgb).save(A + 'paper.webp', 'WEBP', quality=86, method=6)
import os
print('paper.webp', os.path.getsize(A + 'paper.webp') // 1024, 'KB', float(img.mean()))
# Fine neutral film grain for the table (transparent, overlays anything).
g = gaussian_filter(rng(64).standard_normal((G, G)).astype(F), .6, mode='wrap')
g /= g.std()
alpha = np.clip(np.abs(g) * .10, 0, .3)
col = np.where(g[..., None] > 0, 1.0, 0.0) * np.ones((G, G, 3), F)
to_img(col, alpha).save(A + 'grain.png', optimize=True)
print('grain.png', os.path.getsize(A + 'grain.png') // 1024, 'KB')
